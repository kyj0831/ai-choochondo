/**
 * 미팅 예약(/book) 설정.
 *
 * 전부 환경변수로 바꿀 수 있고, 비워 두면 아래 기본값을 쓴다.
 * 근무 시간은 "호스트 시간대" 기준이다 — 방문자가 뉴욕에서 열어도
 * 서울 10:30~18:30 사이 슬롯만 열리고, 화면에는 뉴욕 시각으로 바뀌어 보인다.
 */

function num(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && process.env[name]?.trim() ? v : fallback;
}

function list(name: string, fallback: string): string[] {
  return (process.env[name] || fallback)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** "10:30" → 630 (자정 기준 분) */
function hm(name: string, fallback: string): number {
  const raw = (process.env[name] || fallback).trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) {
    const f = fallback.split(":");
    return Number(f[0]) * 60 + Number(f[1]);
  }
  return Number(m[1]) * 60 + Number(m[2]);
}

export interface BookingConfig {
  host: { name: string; title: string; company: string; initials: string };
  hostTimeZone: string;
  /** 0=일 … 6=토 */
  workDays: number[];
  /** 자정 기준 분 */
  workStart: number;
  workEnd: number;
  slotInterval: number;
  durations: number[];
  minNoticeHours: number;
  maxDaysAhead: number;
  bufferMinutes: number;
  offlineLocation: string;
  /** 일정을 만들 캘린더 */
  calendarId: string;
  /** 바쁜 시간을 확인할 캘린더들(개인·회사 캘린더를 함께 보고 싶을 때) */
  busyCalendarIds: string[];
}

export function getBookingConfig(): BookingConfig {
  const name = process.env.BOOKING_HOST_NAME || "Ingi Kim";
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";
  return {
    host: {
      name,
      title: process.env.BOOKING_HOST_TITLE || "CEO",
      company: process.env.BOOKING_HOST_COMPANY || "Narrative",
      initials:
        process.env.BOOKING_HOST_INITIALS ||
        name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
    },
    hostTimeZone: process.env.BOOKING_HOST_TIMEZONE || "Asia/Seoul",
    workDays: list("BOOKING_WORK_DAYS", "1,2,3,4,5").map(Number).filter((d) => d >= 0 && d <= 6),
    workStart: hm("BOOKING_WORK_START", "10:30"),
    workEnd: hm("BOOKING_WORK_END", "18:30"),
    slotInterval: num("BOOKING_SLOT_INTERVAL", 30),
    durations: list("BOOKING_DURATIONS", "30,60").map(Number).filter((d) => d > 0),
    minNoticeHours: num("BOOKING_MIN_NOTICE_HOURS", 12),
    maxDaysAhead: num("BOOKING_MAX_DAYS_AHEAD", 60),
    bufferMinutes: num("BOOKING_BUFFER_MINUTES", 0),
    offlineLocation: process.env.BOOKING_OFFLINE_LOCATION || "",
    calendarId,
    busyCalendarIds: list("GOOGLE_BUSY_CALENDAR_IDS", calendarId),
  };
}
