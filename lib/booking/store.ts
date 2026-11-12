import { getDb } from "../db";

/**
 * 예약 기능 전용 저장소.
 * 기존 진단 스키마(lib/db.ts)를 건드리지 않도록 여기서 따로 테이블을 만든다.
 */

let ready = false;
function db() {
  const d = getDb();
  if (!ready) {
    d.exec(`
      CREATE TABLE IF NOT EXISTS booking_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        start_at TEXT NOT NULL,
        end_at TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company TEXT NOT NULL,
        job_title TEXT NOT NULL,
        purpose TEXT NOT NULL,
        mode TEXT NOT NULL,
        event_title TEXT,
        google_event_id TEXT,
        meet_link TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_bookings_start ON bookings(start_at);
    `);
    ready = true;
  }
  return d;
}

export function getSetting(key: string): string | undefined {
  const row = db().prepare(`SELECT value FROM booking_settings WHERE key = ?`).get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setSetting(key: string, value: string) {
  db()
    .prepare(
      `INSERT INTO booking_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
    )
    .run(key, value);
}

export interface BookingRow {
  id: string;
  start_at: string;
  end_at: string;
  name: string;
  email: string;
  company: string;
  job_title: string;
  purpose: string;
  mode: "online" | "offline";
  event_title: string | null;
  google_event_id: string | null;
  meet_link: string | null;
}

export function insertBooking(b: BookingRow) {
  db()
    .prepare(
      `INSERT INTO bookings (id, start_at, end_at, name, email, company, job_title, purpose, mode,
         event_title, google_event_id, meet_link)
       VALUES (@id, @start_at, @end_at, @name, @email, @company, @job_title, @purpose, @mode,
         @event_title, @google_event_id, @meet_link)`
    )
    .run(b);
}

/** 기간과 겹치는 예약 (데모 모드에서 이미 잡힌 슬롯을 막는 데 쓴다) */
export function bookingsBetween(startIso: string, endIso: string): { start: string; end: string }[] {
  return db()
    .prepare(`SELECT start_at AS start, end_at AS end FROM bookings WHERE end_at > ? AND start_at < ?`)
    .all(startIso, endIso) as { start: string; end: string }[];
}
