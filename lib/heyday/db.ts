import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import type { Booking, BookingInput } from "./types";

/**
 * HeyDay 저장소.
 *
 * 같은 sqlite 파일을 쓰되 스키마는 이 파일에서만 만든다.
 * HeyDay는 별도 제품이므로 기존 진단 서비스의 마이그레이션에 섞지 않는다.
 *
 * 저장하는 것은 두 가지뿐이다.
 *  1) 예약 요청 — "실제로 돈을 쓸 의사가 있는가"의 유일한 증거
 *  2) 화면 이벤트 — 가격을 본 사람 중 몇 %가 요청했는가(North Star)
 */

let ready = false;

function db() {
  const conn = getDb();
  if (!ready) {
    conn.exec(`
      CREATE TABLE IF NOT EXISTS heyday_events (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        name TEXT NOT NULL,
        props TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_heyday_events_name ON heyday_events(name, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_heyday_events_session ON heyday_events(session_id);

      CREATE TABLE IF NOT EXISTS heyday_bookings (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL DEFAULT '',
        mate_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        activity_id TEXT NOT NULL,
        district TEXT NOT NULL,
        date TEXT NOT NULL,
        slot TEXT NOT NULL,
        duration_min INTEGER NOT NULL,
        price INTEGER NOT NULL,
        guest_name TEXT NOT NULL,
        guest_phone TEXT NOT NULL,
        note TEXT,
        reuse_intent TEXT,
        status TEXT NOT NULL DEFAULT 'requested',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_heyday_bookings_created ON heyday_bookings(created_at DESC);
    `);
    ready = true;
  }
  return conn;
}

export function logEvent(sessionId: string, name: string, props: unknown = {}) {
  db()
    .prepare(
      `INSERT INTO heyday_events (id, session_id, name, props) VALUES (?, ?, ?, ?)`
    )
    .run(randomUUID(), sessionId || "anon", name, JSON.stringify(props ?? {}));
}

export function createBooking(input: BookingInput): string {
  const id = randomUUID().slice(0, 8);
  db()
    .prepare(
      `INSERT INTO heyday_bookings
        (id, session_id, mate_id, category_id, activity_id, district, date, slot,
         duration_min, price, guest_name, guest_phone, note)
       VALUES (@id, @sessionId, @mateId, @categoryId, @activityId, @district, @date, @slot,
               @durationMin, @price, @guestName, @guestPhone, @note)`
    )
    .run({ ...input, id, note: input.note ?? null });
  return id;
}

type Row = Record<string, string | number | null>;

function toBooking(r: Row): Booking {
  return {
    id: String(r.id),
    sessionId: String(r.session_id ?? ""),
    mateId: String(r.mate_id),
    categoryId: String(r.category_id),
    activityId: String(r.activity_id),
    district: String(r.district),
    date: String(r.date),
    slot: String(r.slot) as Booking["slot"],
    durationMin: Number(r.duration_min),
    price: Number(r.price),
    guestName: String(r.guest_name),
    guestPhone: String(r.guest_phone),
    note: r.note ? String(r.note) : undefined,
    reuseIntent: (r.reuse_intent as Booking["reuseIntent"]) ?? null,
    status: String(r.status),
    createdAt: String(r.created_at),
  };
}

export function getBooking(id: string): Booking | null {
  const row = db()
    .prepare(`SELECT * FROM heyday_bookings WHERE id = ?`)
    .get(id) as Row | undefined;
  return row ? toBooking(row) : null;
}

export function setReuseIntent(id: string, intent: "yes" | "maybe" | "no") {
  db()
    .prepare(`UPDATE heyday_bookings SET reuse_intent = ? WHERE id = ?`)
    .run(intent, id);
}

export function listBookings(limit = 100): Booking[] {
  const rows = db()
    .prepare(`SELECT * FROM heyday_bookings ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as Row[];
  return rows.map(toBooking);
}

export interface Funnel {
  /** 홈에 들어온 세션 수 */
  visitors: number;
  /** 카테고리를 고른 세션 수 */
  pickedCategory: number;
  /** 활동을 고른 세션 수 */
  pickedActivity: number;
  /** 가격이 붙은 Mate 목록까지 온 세션 수 — North Star의 분모 */
  sawPrice: number;
  /** Mate 상세까지 본 세션 수 */
  viewedMate: number;
  /** 예약을 요청한 세션 수 — North Star의 분자 */
  requested: number;
}

function sessionsWith(name: string): number {
  const row = db()
    .prepare(
      `SELECT COUNT(DISTINCT session_id) AS n FROM heyday_events WHERE name = ?`
    )
    .get(name) as { n: number };
  return row.n;
}

export function funnel(): Funnel {
  return {
    visitors: sessionsWith("home_viewed"),
    pickedCategory: sessionsWith("category_selected"),
    pickedActivity: sessionsWith("activity_selected"),
    sawPrice: sessionsWith("price_viewed"),
    viewedMate: sessionsWith("mate_viewed"),
    requested: sessionsWith("booking_requested"),
  };
}

/** 이벤트 속성별 집계. "가장 많이 고른 카테고리"처럼 단순 질문에 답한다. */
export function countBy(name: string, prop: string): { value: string; n: number }[] {
  const rows = db()
    .prepare(
      `SELECT json_extract(props, '$.' || ?) AS value, COUNT(*) AS n
         FROM heyday_events
        WHERE name = ? AND json_extract(props, '$.' || ?) IS NOT NULL
        GROUP BY value
        ORDER BY n DESC`
    )
    .all(prop, name, prop) as { value: string | null; n: number }[];
  return rows
    .filter((r) => r.value != null)
    .map((r) => ({ value: String(r.value), n: r.n }));
}
