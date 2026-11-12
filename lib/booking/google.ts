import { getBookingConfig } from "./config";
import { getSetting, setSetting } from "./store";

/**
 * Google Calendar 연동 (googleapis 패키지 없이 REST 직접 호출).
 *
 * 필요한 값
 *  - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET : Google Cloud 콘솔의 OAuth 클라이언트(웹 애플리케이션)
 *  - 리프레시 토큰 : /api/book/google/connect 로 한 번 연결하면 DB에 저장된다.
 *                   (또는 GOOGLE_REFRESH_TOKEN 환경변수로 직접 넣어도 된다 — 이게 우선)
 *
 * 하나라도 없으면 "데모 모드"로 동작한다: 가짜 바쁜 시간으로 화면이 채워지고,
 * 예약은 로컬 DB에만 저장된다.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

const REFRESH_KEY = "google_refresh_token";
const ACCOUNT_KEY = "google_account_email";

export function hasOAuthClient(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function refreshToken(): string | undefined {
  return process.env.GOOGLE_REFRESH_TOKEN?.trim() || getSetting(REFRESH_KEY);
}

export function isGoogleConnected(): boolean {
  return hasOAuthClient() && !!refreshToken();
}

export function connectedAccount(): string | undefined {
  return getSetting(ACCOUNT_KEY);
}

export function saveGoogleConnection(token: string, email?: string) {
  setSetting(REFRESH_KEY, token);
  if (email) setSetting(ACCOUNT_KEY, email);
}

// ---------------- OAuth ----------------

export function buildAuthUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [...GOOGLE_SCOPES, "openid", "email"].join(" "),
    access_type: "offline",
    // 이미 동의한 계정도 refresh_token을 다시 받으려면 consent가 필요하다
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<{ refreshToken?: string; email?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as { refresh_token?: string; id_token?: string; error_description?: string };
  if (!res.ok) throw new Error(json.error_description || `토큰 교환 실패 (${res.status})`);
  let email: string | undefined;
  if (json.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(json.id_token.split(".")[1], "base64url").toString("utf8"));
      email = payload.email;
    } catch {
      /* 이메일은 표시용이라 실패해도 무방 */
    }
  }
  return { refreshToken: json.refresh_token, email };
}

let cachedAccess: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedAccess && cachedAccess.exp > Date.now() + 60_000) return cachedAccess.token;
  const rt = refreshToken();
  if (!rt) throw new Error("Google 캘린더가 연결되지 않았습니다.");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      refresh_token: rt,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error === "invalid_grant"
        ? "Google 연결이 만료됐습니다. /api/book/google/connect 로 다시 연결하세요."
        : json.error_description || `Google 인증 실패 (${res.status})`
    );
  }
  cachedAccess = { token: json.access_token, exp: Date.now() + (json.expires_in || 3600) * 1000 };
  return json.access_token;
}

async function gfetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(json?.error?.message || `Google Calendar API 오류 (${res.status})`);
  return json as T;
}

// ---------------- Calendar ----------------

export interface BusyBlock {
  start: string;
  end: string;
}

export async function queryBusy(timeMin: Date, timeMax: Date): Promise<BusyBlock[]> {
  const cfg = getBookingConfig();
  const json = await gfetch<{ calendars: Record<string, { busy?: BusyBlock[]; errors?: { reason: string }[] }> }>(
    "https://www.googleapis.com/calendar/v3/freeBusy",
    {
      method: "POST",
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: cfg.hostTimeZone,
        items: cfg.busyCalendarIds.map((id) => ({ id })),
      }),
    }
  );
  const out: BusyBlock[] = [];
  for (const [id, cal] of Object.entries(json.calendars || {})) {
    if (cal.errors?.length) {
      // 접근 못 하는 캘린더를 조용히 넘기면 "비어 있음"으로 보여 이중 예약이 난다.
      throw new Error(`캘린더(${id})를 읽을 수 없습니다: ${cal.errors.map((e) => e.reason).join(", ")}`);
    }
    out.push(...(cal.busy || []));
  }
  return out;
}

export interface CreatedEvent {
  id: string;
  htmlLink?: string;
  meetLink?: string;
}

export async function createEvent(input: {
  start: Date;
  end: Date;
  summary: string;
  description: string;
  attendee: { email: string; name: string };
  online: boolean;
  location?: string;
  requestId: string;
}): Promise<CreatedEvent> {
  const cfg = getBookingConfig();
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: cfg.hostTimeZone },
    end: { dateTime: input.end.toISOString(), timeZone: cfg.hostTimeZone },
    attendees: [{ email: input.attendee.email, displayName: input.attendee.name }],
    reminders: { useDefault: true },
  };
  if (input.online) {
    body.conferenceData = {
      createRequest: { requestId: input.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  } else if (input.location) {
    body.location = input.location;
  }
  const url =
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cfg.calendarId)}/events` +
    `?conferenceDataVersion=1&sendUpdates=all`;
  const ev = await gfetch<{
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
  }>(url, { method: "POST", body: JSON.stringify(body) });
  const meet =
    ev.hangoutLink || ev.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri;
  return { id: ev.id, htmlLink: ev.htmlLink, meetLink: meet };
}
