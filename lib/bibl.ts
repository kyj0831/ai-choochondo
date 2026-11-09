import { randomUUID } from "crypto";
import { getDb } from "./db";
import type { VideoResult } from "./youtube";

// ── 타입 ──────────────────────────────────────────────────────────────

export interface Board {
  id: string;
  name: string;
  count: number;
}

/** 썸네일·제목 해부 결과. */
export interface Analysis {
  title: {
    hooks: string[]; // 후킹 유형 (숫자, 질문, 반전 …)
    keyword: string; // 핵심 키워드
    keywordPosition: "앞" | "가운데" | "뒤" | "없음";
    length: number;
    why: string; // 이 제목이 클릭을 부른 이유
  };
  thumbnail: {
    face: string; // 얼굴·표정
    text: string; // 썸네일 문구와 크기
    color: string; // 색·대비
    composition: string; // 구도
    focus: string; // 시선 유도 장치
    titleRelation: string; // 제목과의 관계 (반복/보완/궁금증)
  } | null; // AI 없이(데모)는 썸네일을 볼 수 없어 null
  whyItWorked: string[]; // 잘된 이유 3개
  steal: string[]; // 내 영상에 가져갈 구조 3개
  lessonDraft: string; // "배운 점" 한 줄 초안
  source: "ai" | "rule";
}

export interface RefItem {
  id: string;
  boardId: string | null;
  boardName: string | null;
  video: VideoResult;
  tags: string[];
  note: string;
  analysis: Analysis | null;
  createdAt: string;
}

export interface Remix {
  id: string;
  topic: string;
  result: RemixResult;
  createdAt: string;
}

export interface RemixResult {
  titles: { title: string; hook: string; why: string }[];
  thumbnails: { text: string; layout: string; why: string }[];
  caution: string;
  source: "ai" | "rule";
}

// ── 보드 ──────────────────────────────────────────────────────────────

export function listBoards(owner: string): Board[] {
  return getDb()
    .prepare(
      `SELECT b.id, b.name, COUNT(r.id) AS count
       FROM bibl_boards b LEFT JOIN bibl_refs r ON r.board_id = b.id
       WHERE b.owner_hash = ? GROUP BY b.id ORDER BY b.created_at`
    )
    .all(owner) as Board[];
}

export function createBoard(owner: string, name: string): Board {
  const id = randomUUID();
  getDb().prepare(`INSERT INTO bibl_boards (id, owner_hash, name) VALUES (?, ?, ?)`).run(id, owner, name.trim().slice(0, 40));
  return { id, name: name.trim().slice(0, 40), count: 0 };
}

export function renameBoard(owner: string, id: string, name: string): boolean {
  return getDb().prepare(`UPDATE bibl_boards SET name = ? WHERE id = ? AND owner_hash = ?`).run(name.trim().slice(0, 40), id, owner).changes > 0;
}

export function deleteBoard(owner: string, id: string): boolean {
  return getDb().prepare(`DELETE FROM bibl_boards WHERE id = ? AND owner_hash = ?`).run(id, owner).changes > 0;
}

function ownsBoard(owner: string, id: string | null | undefined): boolean {
  if (!id) return true;
  return !!getDb().prepare(`SELECT 1 FROM bibl_boards WHERE id = ? AND owner_hash = ?`).get(id, owner);
}

// ── 레퍼 ──────────────────────────────────────────────────────────────

interface RefRow {
  id: string;
  board_id: string | null;
  board_name: string | null;
  video_json: string;
  tags: string;
  note: string;
  analysis_json: string | null;
  created_at: string;
}

function toItem(r: RefRow): RefItem {
  return {
    id: r.id,
    boardId: r.board_id,
    boardName: r.board_name,
    video: JSON.parse(r.video_json),
    tags: JSON.parse(r.tags),
    note: r.note,
    analysis: r.analysis_json ? JSON.parse(r.analysis_json) : null,
    createdAt: r.created_at,
  };
}

const SELECT_REF = `SELECT r.id, r.board_id, b.name AS board_name, r.video_json, r.tags, r.note, r.analysis_json, r.created_at
  FROM bibl_refs r LEFT JOIN bibl_boards b ON b.id = r.board_id`;

export function listRefs(owner: string): RefItem[] {
  return (getDb().prepare(`${SELECT_REF} WHERE r.owner_hash = ? ORDER BY r.created_at DESC`).all(owner) as RefRow[]).map(toItem);
}

export function savedVideoIds(owner: string): Record<string, string> {
  const rows = getDb().prepare(`SELECT id, video_id FROM bibl_refs WHERE owner_hash = ?`).all(owner) as { id: string; video_id: string }[];
  return Object.fromEntries(rows.map((r) => [r.video_id, r.id]));
}

export function getRef(owner: string, id: string): RefItem | undefined {
  const row = getDb().prepare(`${SELECT_REF} WHERE r.id = ? AND r.owner_hash = ?`).get(id, owner) as RefRow | undefined;
  return row ? toItem(row) : undefined;
}

export function saveRef(
  owner: string,
  data: { video: VideoResult; boardId?: string | null; note?: string; tags?: string[] }
): RefItem {
  const db = getDb();
  const boardId = ownsBoard(owner, data.boardId) ? data.boardId ?? null : null;
  const existing = db.prepare(`SELECT id FROM bibl_refs WHERE owner_hash = ? AND video_id = ?`).get(owner, data.video.id) as
    | { id: string }
    | undefined;
  if (existing) {
    // 다시 저장하면 최신 숫자로 갱신하고, 새로 준 보드·메모만 덮는다.
    db.prepare(
      `UPDATE bibl_refs SET video_json = ?, board_id = COALESCE(?, board_id),
         note = CASE WHEN ? <> '' THEN ? ELSE note END, updated_at = datetime('now') WHERE id = ?`
    ).run(JSON.stringify(data.video), boardId, data.note ?? "", data.note ?? "", existing.id);
    return getRef(owner, existing.id)!;
  }
  const id = randomUUID();
  db.prepare(
    `INSERT INTO bibl_refs (id, owner_hash, board_id, video_id, video_json, tags, note) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, owner, boardId, data.video.id, JSON.stringify(data.video), JSON.stringify(cleanTags(data.tags ?? [])), (data.note ?? "").slice(0, 500));
  return getRef(owner, id)!;
}

function cleanTags(tags: string[]): string[] {
  return Array.from(new Set(tags.map((t) => t.trim().replace(/^#/, "").slice(0, 20)).filter(Boolean))).slice(0, 12);
}

export function updateRef(
  owner: string,
  id: string,
  patch: { note?: string; tags?: string[]; boardId?: string | null }
): RefItem | undefined {
  const ref = getRef(owner, id);
  if (!ref) return undefined;
  const db = getDb();
  if (patch.note !== undefined)
    db.prepare(`UPDATE bibl_refs SET note = ?, updated_at = datetime('now') WHERE id = ?`).run(patch.note.slice(0, 500), id);
  if (patch.tags !== undefined)
    db.prepare(`UPDATE bibl_refs SET tags = ?, updated_at = datetime('now') WHERE id = ?`).run(JSON.stringify(cleanTags(patch.tags)), id);
  if (patch.boardId !== undefined && ownsBoard(owner, patch.boardId))
    db.prepare(`UPDATE bibl_refs SET board_id = ?, updated_at = datetime('now') WHERE id = ?`).run(patch.boardId, id);
  return getRef(owner, id);
}

export function setAnalysis(owner: string, id: string, a: Analysis) {
  getDb().prepare(`UPDATE bibl_refs SET analysis_json = ? WHERE id = ? AND owner_hash = ?`).run(JSON.stringify(a), id, owner);
}

export function deleteRef(owner: string, id: string): boolean {
  return getDb().prepare(`DELETE FROM bibl_refs WHERE id = ? AND owner_hash = ?`).run(id, owner).changes > 0;
}

// ── 내 버전 ───────────────────────────────────────────────────────────

export function listRemixes(refId: string): Remix[] {
  return (
    getDb().prepare(`SELECT id, topic, result_json, created_at FROM bibl_remixes WHERE ref_id = ? ORDER BY created_at DESC`).all(refId) as {
      id: string;
      topic: string;
      result_json: string;
      created_at: string;
    }[]
  ).map((r) => ({ id: r.id, topic: r.topic, result: JSON.parse(r.result_json), createdAt: r.created_at }));
}

export function addRemix(refId: string, topic: string, result: RemixResult): Remix {
  const id = randomUUID();
  getDb().prepare(`INSERT INTO bibl_remixes (id, ref_id, topic, result_json) VALUES (?, ?, ?, ?)`).run(id, refId, topic, JSON.stringify(result));
  return { id, topic, result, createdAt: new Date().toISOString() };
}
