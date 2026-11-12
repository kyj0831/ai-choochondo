/**
 * 외부 라이브러리 없이 IANA 시간대를 다루는 최소 유틸.
 * 서버(Node)와 브라우저 양쪽에서 쓴다.
 */

const fmtCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=일
}

export function zonedParts(date: Date, tz: string): ZonedParts {
  const parts = partsFormatter(tz).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "0";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")) % 24,
    minute: Number(get("minute")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/** 해당 시각에 tz가 UTC보다 몇 분 앞서는지 (서울 = +540) */
export function tzOffsetMinutes(tz: string, date: Date): number {
  const p = zonedParts(date, tz);
  const sec = Number(
    partsFormatter(tz)
      .formatToParts(date)
      .find((x) => x.type === "second")?.value || 0
  );
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, sec);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** tz 기준 벽시계 시각 → 실제 시점(UTC Date). 서머타임 경계도 처리한다. */
export function zonedToUtc(y: number, m: number, d: number, minutesOfDay: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, 0, minutesOfDay);
  const off1 = tzOffsetMinutes(tz, new Date(guess));
  let t = guess - off1 * 60000;
  const off2 = tzOffsetMinutes(tz, new Date(t));
  if (off2 !== off1) t = guess - off2 * 60000;
  return new Date(t);
}

/** tz 기준 날짜 키 "2026-11-17" */
export function dateKey(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "GMT+9", "GMT-4:30" */
export function gmtLabel(tz: string, date = new Date()): string {
  const off = tzOffsetMinutes(tz, date);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? ":" + String(m).padStart(2, "0") : ""}`;
}
