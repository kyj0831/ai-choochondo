import { v4 as uuid } from "uuid";
import { getDb } from "./db";
import { EvidenceRow, GroundTruthFact, Hub, HubInput, HubRow, OfficialAsset, Project, QueryRow, ReportRow } from "./types";

// ---- Projects ----
export function createProject(data: {
  brand_name: string;
  entity_type: string;
  region: string;
  language: string;
  categories: string[];
  audiences: string[];
}): Project {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO projects (id, brand_name, entity_type, region, language, categories, audiences, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'setup')`
  ).run(id, data.brand_name, data.entity_type, data.region, data.language, JSON.stringify(data.categories), JSON.stringify(data.audiences));
  return getProject(id)!;
}

export function getProject(id: string): Project | undefined {
  return getDb().prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as Project | undefined;
}

export function listProjects(): Project[] {
  return getDb().prepare(`SELECT * FROM projects ORDER BY created_at DESC`).all() as Project[];
}

export function updateProjectStatus(id: string, status: Project["status"]) {
  getDb().prepare(`UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
}

export function updateProjectMeta(
  id: string,
  data: Partial<Pick<Project, "categories" | "audiences" | "same_name_conflict" | "same_name_note">>
) {
  const db = getDb();
  const current = getProject(id);
  if (!current) return;
  db.prepare(
    `UPDATE projects SET categories = ?, audiences = ?, same_name_conflict = ?, same_name_note = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(
    data.categories !== undefined ? JSON.stringify(data.categories) : current.categories,
    data.audiences !== undefined ? JSON.stringify(data.audiences) : current.audiences,
    data.same_name_conflict !== undefined ? data.same_name_conflict : current.same_name_conflict,
    data.same_name_note !== undefined ? data.same_name_note : current.same_name_note,
    id
  );
}

// ---- Official assets ----
export function addAsset(projectId: string, url: string, platform: string): OfficialAsset {
  const db = getDb();
  const id = uuid();
  db.prepare(`INSERT INTO official_assets (id, project_id, url, platform, verified_by_user) VALUES (?, ?, ?, ?, 1)`).run(
    id,
    projectId,
    url,
    platform
  );
  return db.prepare(`SELECT * FROM official_assets WHERE id = ?`).get(id) as OfficialAsset;
}

export function listAssets(projectId: string): OfficialAsset[] {
  return getDb().prepare(`SELECT * FROM official_assets WHERE project_id = ? ORDER BY created_at`).all(projectId) as OfficialAsset[];
}

export function deleteAsset(id: string) {
  getDb().prepare(`DELETE FROM official_assets WHERE id = ?`).run(id);
}

// ---- Ground truth facts ----
export function upsertFact(projectId: string, field: string, value: string, sourceUrl: string | null): GroundTruthFact {
  const db = getDb();
  const existing = db
    .prepare(`SELECT * FROM ground_truth_facts WHERE project_id = ? AND field = ?`)
    .get(projectId, field) as GroundTruthFact | undefined;
  if (existing) {
    db.prepare(`UPDATE ground_truth_facts SET value = ?, source_url = ?, approved = 1 WHERE id = ?`).run(value, sourceUrl, existing.id);
    return { ...existing, value, source_url: sourceUrl, approved: 1 };
  }
  const id = uuid();
  db.prepare(`INSERT INTO ground_truth_facts (id, project_id, field, value, source_url, approved) VALUES (?, ?, ?, ?, ?, 1)`).run(
    id,
    projectId,
    field,
    value,
    sourceUrl
  );
  return { id, project_id: projectId, field, value, source_url: sourceUrl, approved: 1 };
}

export function listFacts(projectId: string): GroundTruthFact[] {
  return getDb().prepare(`SELECT * FROM ground_truth_facts WHERE project_id = ?`).all(projectId) as GroundTruthFact[];
}

// ---- Queries ----
export function insertQueries(
  projectId: string,
  queries: { text: string; type: string; sub_category: string | null; importance: number; created_by?: "system" | "user" }[]
): QueryRow[] {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO queries (id, project_id, text, type, sub_category, importance, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMany = db.transaction((rows: typeof queries) => {
    for (const q of rows) {
      stmt.run(uuid(), projectId, q.text, q.type, q.sub_category, q.importance, q.created_by || "system");
    }
  });
  insertMany(queries);
  return listQueries(projectId);
}

export function listQueries(projectId: string): QueryRow[] {
  return getDb()
    .prepare(`SELECT * FROM queries WHERE project_id = ? AND deleted = 0 ORDER BY type, created_at`)
    .all(projectId) as QueryRow[];
}

export function deleteQuery(id: string) {
  getDb().prepare(`UPDATE queries SET deleted = 1 WHERE id = ?`).run(id);
}

/**
 * 시스템이 생성한 질문만 비운다. 사용자가 직접 추가·수정한 질문은 남긴다.
 * 질문 세트를 다시 뽑을 때 이전 질문이 누적되는 것을 막는다.
 */
export function clearSystemQueries(projectId: string) {
  getDb()
    .prepare(`UPDATE queries SET deleted = 1 WHERE project_id = ? AND created_by = 'system'`)
    .run(projectId);
}

export function updateQuery(id: string, data: Partial<Pick<QueryRow, "text" | "importance">>) {
  const db = getDb();
  const current = db.prepare(`SELECT * FROM queries WHERE id = ?`).get(id) as QueryRow | undefined;
  if (!current) return;
  db.prepare(`UPDATE queries SET text = ?, importance = ? WHERE id = ?`).run(
    data.text ?? current.text,
    data.importance ?? current.importance,
    id
  );
}

// ---- Evidence ----
export function addEvidence(data: {
  project_id: string;
  query_id: string;
  engine_label: string;
  response_text: string;
  status: "collected" | "not_found" | "collection_failed";
}): EvidenceRow {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO evidence (id, project_id, query_id, engine_label, response_text, status) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, data.project_id, data.query_id, data.engine_label, data.response_text, data.status);
  return db.prepare(`SELECT * FROM evidence WHERE id = ?`).get(id) as EvidenceRow;
}

export function updateEvidenceJudgment(
  id: string,
  j: {
    entity_found: boolean;
    mention_type: string;
    position: number | null;
    description_accuracy: number;
    conflicts: string[];
    source_types: string[];
    citations: string[];
    confidence: number;
  }
) {
  getDb()
    .prepare(
      `UPDATE evidence SET entity_found = ?, mention_type = ?, position = ?, description_accuracy = ?, conflicts = ?, source_types = ?, citations = ?, confidence = ?, judged_at = datetime('now') WHERE id = ?`
    )
    .run(
      j.entity_found ? 1 : 0,
      j.mention_type,
      j.position,
      j.description_accuracy,
      JSON.stringify(j.conflicts),
      JSON.stringify(j.source_types),
      JSON.stringify(j.citations),
      j.confidence,
      id
    );
}

export function listEvidence(projectId: string): EvidenceRow[] {
  return getDb().prepare(`SELECT * FROM evidence WHERE project_id = ? ORDER BY created_at`).all(projectId) as EvidenceRow[];
}

export function listEvidenceForQuery(queryId: string): EvidenceRow[] {
  return getDb().prepare(`SELECT * FROM evidence WHERE query_id = ? ORDER BY created_at`).all(queryId) as EvidenceRow[];
}

export function deleteEvidence(id: string) {
  getDb().prepare(`DELETE FROM evidence WHERE id = ?`).run(id);
}

// ---- Reports ----
export function saveReport(projectId: string, reportJson: unknown, total: number, grade: string, trustBadge: string): ReportRow {
  const db = getDb();
  const id = uuid();
  const last = db
    .prepare(`SELECT MAX(run_number) as m FROM reports WHERE project_id = ?`)
    .get(projectId) as { m: number | null };
  const runNumber = (last.m || 0) + 1;
  db.prepare(
    `INSERT INTO reports (id, project_id, run_number, report_json, score_total, grade, trust_badge) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, projectId, runNumber, JSON.stringify(reportJson), total, grade, trustBadge);
  return db.prepare(`SELECT * FROM reports WHERE id = ?`).get(id) as ReportRow;
}

export function listReports(projectId: string): ReportRow[] {
  return getDb().prepare(`SELECT * FROM reports WHERE project_id = ? ORDER BY run_number DESC`).all(projectId) as ReportRow[];
}

export function getLatestReport(projectId: string): ReportRow | undefined {
  return getDb()
    .prepare(`SELECT * FROM reports WHERE project_id = ? ORDER BY run_number DESC LIMIT 1`)
    .get(projectId) as ReportRow | undefined;
}

export function getReport(id: string): ReportRow | undefined {
  return getDb().prepare(`SELECT * FROM reports WHERE id = ?`).get(id) as ReportRow | undefined;
}

// ---- AI 프로필 허브 ----
function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function hydrateHub(row: HubRow): Hub {
  return {
    ...row,
    published: row.published === 1,
    keywords: parseJson<string[]>(row.keywords, []),
    audiences: parseJson<string[]>(row.audiences, []),
    links: parseJson<Hub["links"]>(row.links, []),
    faq: parseJson<Hub["faq"]>(row.faq, []),
    services: parseJson<Hub["services"]>(row.services, []),
  };
}

/** 슬러그를 URL 안전한 형태로 정규화한다. 한글은 그대로 두되 공백·특수문자만 제거한다. */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9가-힣\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export function isSlugTaken(slug: string, exceptHubId?: string): boolean {
  const row = getDb().prepare(`SELECT id FROM hubs WHERE slug = ?`).get(slug) as { id: string } | undefined;
  if (!row) return false;
  return row.id !== exceptHubId;
}

/** 원하는 슬러그가 이미 쓰이면 -2, -3 … 을 붙여 비어 있는 것을 돌려준다. */
export function availableSlug(desired: string): string {
  const base = normalizeSlug(desired) || "brand";
  if (!isSlugTaken(base)) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}-${i}`;
    if (!isSlugTaken(candidate)) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function getHubByProject(projectId: string): Hub | undefined {
  const row = getDb().prepare(`SELECT * FROM hubs WHERE project_id = ?`).get(projectId) as HubRow | undefined;
  return row ? hydrateHub(row) : undefined;
}

export function getHubBySlug(slug: string): Hub | undefined {
  // 한글 슬러그는 URL에서 퍼센트 인코딩된 채로 넘어올 수 있다.
  // 인코딩/디코딩 양쪽으로 조회해 어느 형태로 들어와도 찾도록 한다.
  const candidates = new Set<string>([slug]);
  try {
    candidates.add(decodeURIComponent(slug));
  } catch {
    // 잘못된 인코딩이면 원본만 사용한다.
  }

  const db = getDb();
  for (const s of candidates) {
    const row = db.prepare(`SELECT * FROM hubs WHERE slug = ?`).get(s) as HubRow | undefined;
    if (row) return hydrateHub(row);
  }
  return undefined;
}

export function listPublishedHubs(): Hub[] {
  const rows = getDb().prepare(`SELECT * FROM hubs WHERE published = 1 ORDER BY updated_at DESC`).all() as HubRow[];
  return rows.map(hydrateHub);
}

export function createHub(projectId: string, data: HubInput & { display_name: string; slug: string }): Hub {
  const db = getDb();
  const id = uuid();
  db.prepare(
    `INSERT INTO hubs (id, project_id, slug, published, display_name, headline, one_liner, bio, region,
       keywords, audiences, links, faq, services, contact_email, contact_note, accent, source_report_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    projectId,
    data.slug,
    data.published ? 1 : 0,
    data.display_name,
    data.headline ?? "",
    data.one_liner ?? "",
    data.bio ?? "",
    data.region ?? "",
    JSON.stringify(data.keywords ?? []),
    JSON.stringify(data.audiences ?? []),
    JSON.stringify(data.links ?? []),
    JSON.stringify(data.faq ?? []),
    JSON.stringify(data.services ?? []),
    data.contact_email ?? null,
    data.contact_note ?? null,
    data.accent ?? "indigo",
    data.source_report_id ?? null
  );
  return hydrateHub(db.prepare(`SELECT * FROM hubs WHERE id = ?`).get(id) as HubRow);
}

export function updateHub(id: string, data: HubInput): Hub | undefined {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM hubs WHERE id = ?`).get(id) as HubRow | undefined;
  if (!row) return undefined;
  const current = hydrateHub(row);

  const next = {
    slug: data.slug ?? current.slug,
    published: data.published !== undefined ? data.published : current.published,
    display_name: data.display_name ?? current.display_name,
    headline: data.headline ?? current.headline,
    one_liner: data.one_liner ?? current.one_liner,
    bio: data.bio ?? current.bio,
    region: data.region ?? current.region,
    keywords: data.keywords ?? current.keywords,
    audiences: data.audiences ?? current.audiences,
    links: data.links ?? current.links,
    faq: data.faq ?? current.faq,
    services: data.services ?? current.services,
    contact_email: data.contact_email !== undefined ? data.contact_email : current.contact_email,
    contact_note: data.contact_note !== undefined ? data.contact_note : current.contact_note,
    accent: data.accent ?? current.accent,
    source_report_id: data.source_report_id !== undefined ? data.source_report_id : current.source_report_id,
  };

  // 최초 발행 시점만 기록한다. 이후 비공개→발행을 반복해도 기준선은 흔들리지 않는다.
  const publishedAt = next.published && !row.published_at ? "datetime('now')" : null;

  db.prepare(
    `UPDATE hubs SET slug = ?, published = ?, display_name = ?, headline = ?, one_liner = ?, bio = ?, region = ?,
       keywords = ?, audiences = ?, links = ?, faq = ?, services = ?, contact_email = ?, contact_note = ?,
       accent = ?, source_report_id = ?,
       published_at = ${publishedAt ? "datetime('now')" : "published_at"},
       updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    next.slug,
    next.published ? 1 : 0,
    next.display_name,
    next.headline,
    next.one_liner,
    next.bio,
    next.region,
    JSON.stringify(next.keywords),
    JSON.stringify(next.audiences),
    JSON.stringify(next.links),
    JSON.stringify(next.faq),
    JSON.stringify(next.services),
    next.contact_email,
    next.contact_note,
    next.accent,
    next.source_report_id,
    id
  );

  return hydrateHub(db.prepare(`SELECT * FROM hubs WHERE id = ?`).get(id) as HubRow);
}

export function incrementHubView(id: string) {
  getDb().prepare(`UPDATE hubs SET view_count = view_count + 1 WHERE id = ?`).run(id);
}

export function deleteHub(id: string) {
  getDb().prepare(`DELETE FROM hubs WHERE id = ?`).run(id);
}

// ---- AI 크롤러 접근 로그 ----
export interface HubCrawlRow {
  id: string;
  hub_id: string;
  bot_key: string;
  bot_label: string;
  operator: string;
  path: string;
  user_agent: string;
  created_at: string;
}

export function recordCrawl(data: {
  hub_id: string;
  bot_key: string;
  bot_label: string;
  operator: string;
  path: string;
  user_agent: string;
}) {
  getDb()
    .prepare(
      `INSERT INTO hub_crawls (id, hub_id, bot_key, bot_label, operator, path, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(uuid(), data.hub_id, data.bot_key, data.bot_label, data.operator, data.path, data.user_agent);
}

export function listCrawls(hubId: string, limit = 100): HubCrawlRow[] {
  return getDb()
    .prepare(`SELECT * FROM hub_crawls WHERE hub_id = ? ORDER BY created_at DESC LIMIT ?`)
    .all(hubId, limit) as HubCrawlRow[];
}

/** 사업자별 최근 방문 요약. 허브 대시보드에서 "누가 언제 읽어갔는가"를 보여준다. */
export function crawlSummary(hubId: string): {
  total: number;
  byOperator: { operator: string; bots: string[]; count: number; last_seen: string }[];
} {
  const db = getDb();
  const total = (db.prepare(`SELECT COUNT(*) as c FROM hub_crawls WHERE hub_id = ?`).get(hubId) as { c: number }).c;
  const rows = db
    .prepare(
      `SELECT operator, COUNT(*) as count, MAX(created_at) as last_seen,
              GROUP_CONCAT(DISTINCT bot_label) as bots
       FROM hub_crawls WHERE hub_id = ?
       GROUP BY operator ORDER BY count DESC`
    )
    .all(hubId) as { operator: string; count: number; last_seen: string; bots: string }[];

  return {
    total,
    byOperator: rows.map((r) => ({
      operator: r.operator,
      bots: (r.bots || "").split(",").filter(Boolean),
      count: r.count,
      last_seen: r.last_seen,
    })),
  };
}
