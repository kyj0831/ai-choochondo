import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// 배포 시 영구 볼륨 경로를 DATA_DIR로 지정한다(예: Railway 볼륨 마운트 /data).
// 미설정 시 로컬 개발용으로 프로젝트 내 data/ 폴더를 사용한다.
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "app.sqlite");

declare global {
  // eslint-disable-next-line no-var
  var __aiChoochondoDb: Database.Database | undefined;
}

function createConnection() {
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      brand_name TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      region TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT '한국어',
      categories TEXT NOT NULL DEFAULT '[]',
      audiences TEXT NOT NULL DEFAULT '[]',
      same_name_conflict INTEGER NOT NULL DEFAULT 0,
      same_name_note TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS official_assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      platform TEXT NOT NULL,
      verified_by_user INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS ground_truth_facts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      field TEXT NOT NULL,
      value TEXT NOT NULL,
      source_url TEXT,
      approved INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS queries (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      type TEXT NOT NULL,
      sub_category TEXT,
      importance INTEGER NOT NULL DEFAULT 2,
      created_by TEXT NOT NULL DEFAULT 'system',
      deleted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      query_id TEXT NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
      engine_label TEXT NOT NULL,
      response_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'collected',
      entity_found INTEGER,
      mention_type TEXT,
      position INTEGER,
      description_accuracy REAL,
      conflicts TEXT,
      source_types TEXT,
      citations TEXT,
      confidence REAL,
      judged_at TEXT,
      is_sample INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      run_number INTEGER NOT NULL,
      report_json TEXT NOT NULL,
      score_total REAL NOT NULL,
      grade TEXT NOT NULL,
      trust_badge TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- AI 프로필 허브: AI가 공식 정보로 인식하도록 단일 URL에 정체성·링크·FAQ를 모은 공개 페이지
    CREATE TABLE IF NOT EXISTS hubs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      slug TEXT NOT NULL UNIQUE,
      published INTEGER NOT NULL DEFAULT 0,
      display_name TEXT NOT NULL,
      headline TEXT NOT NULL DEFAULT '',
      one_liner TEXT NOT NULL DEFAULT '',
      bio TEXT NOT NULL DEFAULT '',
      region TEXT NOT NULL DEFAULT '',
      keywords TEXT NOT NULL DEFAULT '[]',
      audiences TEXT NOT NULL DEFAULT '[]',
      links TEXT NOT NULL DEFAULT '[]',
      faq TEXT NOT NULL DEFAULT '[]',
      services TEXT NOT NULL DEFAULT '[]',
      contact_email TEXT,
      contact_note TEXT,
      accent TEXT NOT NULL DEFAULT 'indigo',
      view_count INTEGER NOT NULL DEFAULT 0,
      source_report_id TEXT,
      -- 최초 발행 시점. 허브 발행 전/후 점수 변화를 귀속시키는 기준선이 된다.
      published_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hubs_project ON hubs(project_id);
    CREATE INDEX IF NOT EXISTS idx_hubs_slug ON hubs(slug);

    -- 허브를 읽어간 AI 크롤러 접근 기록.
    -- 우리가 페이지를 직접 서빙하므로 GPTBot·ClaudeBot·PerplexityBot 등의 방문을 관측할 수 있다.
    -- "AI가 내 정보를 실제로 수집했는가"에 답하는 유일한 직접 증거다.
    CREATE TABLE IF NOT EXISTS hub_crawls (
      id TEXT PRIMARY KEY,
      hub_id TEXT NOT NULL REFERENCES hubs(id) ON DELETE CASCADE,
      bot_key TEXT NOT NULL,
      bot_label TEXT NOT NULL,
      operator TEXT NOT NULL,
      path TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_crawls_hub ON hub_crawls(hub_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_assets_project ON official_assets(project_id);
    CREATE INDEX IF NOT EXISTS idx_facts_project ON ground_truth_facts(project_id);
    CREATE INDEX IF NOT EXISTS idx_queries_project ON queries(project_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_project ON evidence(project_id);
    CREATE INDEX IF NOT EXISTS idx_evidence_query ON evidence(query_id);
    CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(project_id);
  `);

  // 기존 DB에 나중에 추가된 컬럼을 보정한다. CREATE TABLE IF NOT EXISTS는
  // 이미 만들어진 테이블에 새 컬럼을 넣어주지 않기 때문이다.
  addColumnIfMissing(db, "hubs", "published_at", "TEXT");
  // 샘플(데모) 증거로 채워진 진단을 리포트에서 구분하기 위한 표식.
  // 실제 AI 답변 없이 만들어진 리포트가 진짜 진단처럼 보이는 사고를 막는다.
  addColumnIfMissing(db, "evidence", "is_sample", "INTEGER NOT NULL DEFAULT 0");
}

function addColumnIfMissing(db: Database.Database, table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (cols.length === 0) return; // 테이블 자체가 없으면 스킵
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

export function getDb(): Database.Database {
  if (!global.__aiChoochondoDb) {
    global.__aiChoochondoDb = createConnection();
  }
  return global.__aiChoochondoDb;
}
