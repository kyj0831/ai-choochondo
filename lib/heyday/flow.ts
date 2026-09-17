import { MATES, SLOTS } from "./data";
import type { Mate, SlotKey } from "./types";

/**
 * 예약 흐름의 상태는 URL에만 둔다.
 *
 * 이유: 5060 사용자는 브라우저 뒤로가기를 많이 쓴다. 상태를 메모리에 두면
 * 뒤로 갔을 때 선택이 사라져 처음부터 다시 하게 된다. URL에 두면
 * 뒤로가기·새로고침·링크 공유가 전부 그냥 동작한다.
 */
export interface Flow {
  category?: string;
  activity?: string;
  /** yyyy-mm-dd (서울 기준) */
  date?: string;
  slot?: SlotKey;
  district?: string;
}

type RawParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.length > 0 ? s : undefined;
}

export function readFlow(params: RawParams): Flow {
  const slot = one(params.t);
  return {
    category: one(params.c),
    activity: one(params.a),
    date: one(params.d),
    slot: SLOTS.some((s) => s.key === slot) ? (slot as SlotKey) : undefined,
    district: one(params.r),
  };
}

/** 다음 화면 링크를 만든다. 넘길 값만 덮어쓴다. */
export function href(path: string, flow: Flow, patch: Flow = {}): string {
  const next = { ...flow, ...patch };
  const q = new URLSearchParams();
  if (next.category) q.set("c", next.category);
  if (next.activity) q.set("a", next.activity);
  if (next.date) q.set("d", next.date);
  if (next.slot) q.set("t", next.slot);
  if (next.district) q.set("r", next.district);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/* ── 날짜 ─────────────────────────────────────────────────────────── */

/**
 * 서울 기준 오늘. 서버 타임존이 UTC면 한국 시간 자정~오전 9시 사이에
 * "오늘"이 하루 밀린다. 이 앱은 서울 전용이므로 타임존을 못 박는다.
 */
export function seoulToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00+09:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00+09:00`).getUTCDay();
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

/** "10월 3일 (금)" 처럼 읽는 그대로 쓴다. */
export function formatDate(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}월 ${Number(d)}일 (${WEEKDAY_LABELS[weekdayOf(date)]})`;
}

/** "오늘", "내일", 그 외에는 날짜. 오늘·내일이 압도적으로 많이 선택된다. */
export function dateLabel(date: string): string {
  const today = seoulToday();
  if (date === today) return "오늘";
  if (date === addDays(today, 1)) return "내일";
  return formatDate(date);
}

export function slotLabel(slot: SlotKey): string {
  return SLOTS.find((s) => s.key === slot)?.label ?? "";
}

/** 선택 내용을 한 줄로. 화면 위에 계속 보여줘서 "내가 뭘 고르는 중인지" 잃지 않게 한다. */
export function flowSummary(flow: Flow): string {
  const parts: string[] = [];
  if (flow.date) parts.push(dateLabel(flow.date));
  if (flow.slot) parts.push(slotLabel(flow.slot));
  if (flow.district) parts.push(flow.district);
  return parts.join(" · ");
}

/* ── Mate 매칭 ────────────────────────────────────────────────────── */

export function isAvailable(mate: Mate, date: string, slot: SlotKey): boolean {
  return (mate.availability[weekdayOf(date)] ?? []).includes(slot);
}

export interface MateMatch {
  mate: Mate;
  /** 모든 조건(활동·지역·시간)을 만족하는가. */
  exact: boolean;
  /** 못 맞춘 조건. 목록에서 솔직하게 표시한다. */
  missing: { district: boolean; time: boolean };
}

/**
 * Mate를 고른다.
 *
 * 조건을 다 만족하는 Mate가 없을 때 빈 화면을 보여주면 검증이 거기서 끊긴다.
 * 그래서 활동이 맞는 Mate는 모두 보여주되, 어떤 조건이 안 맞는지를
 * 카드에 그대로 적는다. 사용자가 "시간을 바꿔서라도 이 사람"을 고르는지가
 * Mate 선택 기준(PRD 14장)에 대한 답이 된다.
 */
export function matchMates(flow: Flow): MateMatch[] {
  const pool = flow.activity
    ? MATES.filter((m) => m.activityIds.includes(flow.activity!))
    : MATES;

  const matches: MateMatch[] = pool.map((mate) => {
    const districtOk = !flow.district || mate.districts.includes(flow.district);
    const timeOk =
      !flow.date || !flow.slot || isAvailable(mate, flow.date, flow.slot);
    return {
      mate,
      exact: districtOk && timeOk,
      missing: { district: !districtOk, time: !timeOk },
    };
  });

  // 조건을 다 맞춘 Mate가 위로. 그 다음은 평점과 활동 횟수 순.
  return matches.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    const missA = Number(a.missing.district) + Number(a.missing.time);
    const missB = Number(b.missing.district) + Number(b.missing.time);
    if (missA !== missB) return missA - missB;
    if (b.mate.rating !== a.mate.rating) return b.mate.rating - a.mate.rating;
    return b.mate.sessionCount - a.mate.sessionCount;
  });
}

/** "오늘 오후 가능" 처럼 카드에 붙는 한 줄. */
export function availabilityNote(mate: Mate, flow: Flow): string {
  if (flow.date && flow.slot && isAvailable(mate, flow.date, flow.slot)) {
    return `${dateLabel(flow.date)} ${slotLabel(flow.slot)} 가능`;
  }
  // 요청한 시간이 안 되면, 가장 가까운 가능한 날을 알려준다.
  const start = flow.date ?? seoulToday();
  for (let i = 0; i < 14; i++) {
    const date = addDays(start, i);
    const slots = mate.availability[weekdayOf(date)] ?? [];
    if (slots.length > 0) {
      return `${dateLabel(date)} ${slots.map(slotLabel).join("·")} 가능`;
    }
  }
  return "시간 조율 필요";
}

export function priceLabel(mate: Mate): string {
  return `${mate.durationMin}분 ${mate.price.toLocaleString("ko-KR")}원`;
}
