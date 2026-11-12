import { getBookingConfig } from "./config";
import { BusyBlock, isGoogleConnected, queryBusy } from "./google";
import { bookingsBetween } from "./store";
import { zonedParts, zonedToUtc } from "./time";

export type CalendarMode = "google" | "demo";

export function calendarMode(): CalendarMode {
  return isGoogleConnected() ? "google" : "demo";
}

/**
 * 데모 모드용 가짜 일정. 날짜마다 결정적으로(새로고침해도 같게) 1~3개 블록을 만든다.
 * 실제 캘린더를 연결하기 전에 화면 흐름을 확인하는 용도다.
 */
function demoBusy(from: Date, to: Date): BusyBlock[] {
  const cfg = getBookingConfig();
  const out: BusyBlock[] = [];
  const day = new Date(from.getTime());
  for (let i = 0; i < 120 && day < to; i++, day.setUTCDate(day.getUTCDate() + 1)) {
    const p = zonedParts(day, cfg.hostTimeZone);
    const seed = (p.year * 372 + p.month * 31 + p.day) * 2654435761;
    const n = 1 + (Math.abs(seed) % 3);
    for (let k = 0; k < n; k++) {
      const r = Math.abs((seed >> (k * 5)) ^ (k * 977));
      const startMin = 600 + (r % 16) * 30; // 10:00~17:30
      const len = 30 * (1 + (r % 3));
      const s = zonedToUtc(p.year, p.month, p.day, startMin, cfg.hostTimeZone);
      out.push({ start: s.toISOString(), end: new Date(s.getTime() + len * 60000).toISOString() });
    }
  }
  return out;
}

export async function getBusy(from: Date, to: Date): Promise<BusyBlock[]> {
  if (calendarMode() === "google") return queryBusy(from, to);
  return [...demoBusy(from, to), ...bookingsBetween(from.toISOString(), to.toISOString())];
}

/**
 * [from, to) 구간에서 duration분짜리 미팅을 시작할 수 있는 시각 목록(UTC ISO).
 * 근무 요일·시간은 호스트 시간대 기준으로 자르고, 최소 사전 예약 시간과 버퍼를 반영한다.
 */
export async function availableSlots(fromIn: Date, toIn: Date, duration: number, now = new Date()): Promise<string[]> {
  const cfg = getBookingConfig();
  const earliest = new Date(now.getTime() + cfg.minNoticeHours * 3600_000);
  const latest = new Date(now.getTime() + cfg.maxDaysAhead * 86400_000);
  const from = new Date(Math.max(fromIn.getTime(), earliest.getTime()));
  const to = new Date(Math.min(toIn.getTime(), latest.getTime()));
  if (from >= to) return [];

  const busy = (await getBusy(new Date(from.getTime() - 86400_000), new Date(to.getTime() + 86400_000)))
    .map((b) => ({
      s: new Date(b.start).getTime() - cfg.bufferMinutes * 60000,
      e: new Date(b.end).getTime() + cfg.bufferMinutes * 60000,
    }))
    .sort((a, b) => a.s - b.s);

  const slots: string[] = [];
  // 호스트 시간대 기준 날짜를 하루씩 훑는다
  const cursor = zonedParts(new Date(from.getTime() - 86400_000), cfg.hostTimeZone);
  let y = cursor.year,
    m = cursor.month,
    d = cursor.day;
  for (let guard = 0; guard < cfg.maxDaysAhead + 5; guard++) {
    const dayStart = zonedToUtc(y, m, d, 0, cfg.hostTimeZone);
    if (dayStart.getTime() > to.getTime()) break;
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (cfg.workDays.includes(weekday)) {
      for (let t = cfg.workStart; t + duration <= cfg.workEnd; t += cfg.slotInterval) {
        const s = zonedToUtc(y, m, d, t, cfg.hostTimeZone).getTime();
        const e = s + duration * 60000;
        if (s < from.getTime() || s >= to.getTime()) continue;
        if (busy.some((b) => b.s < e && b.e > s)) continue;
        slots.push(new Date(s).toISOString());
      }
    }
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    y = next.getUTCFullYear();
    m = next.getUTCMonth() + 1;
    d = next.getUTCDate();
  }
  return slots;
}

/** 예약 직전 재확인: 이 시각이 여전히 열려 있는가 */
export async function isSlotStillFree(start: Date, duration: number): Promise<boolean> {
  const cfg = getBookingConfig();
  if (!cfg.durations.includes(duration)) return false;
  const slots = await availableSlots(
    new Date(start.getTime() - 60000),
    new Date(start.getTime() + 60000),
    duration
  );
  return slots.includes(start.toISOString());
}
