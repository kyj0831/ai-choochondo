export type EntityType =
  | "개인 브랜드/강사"
  | "자영업/로컬"
  | "기업/제품"
  | "전문 서비스";

export type QueryType = "direct" | "recommend" | "explain" | "compare" | "situational";

export type MentionType =
  | "recommended_candidate"
  | "simple_mention"
  | "not_found"
  | "collection_failed";

export type SourceType =
  | "official_site"
  | "official_sns"
  | "map_listing"
  | "marketplace"
  | "news_media"
  | "institution"
  | "author_profile"
  | "ugc"
  | "unknown";

export type FindingStatus = "good" | "meh" | "needs_work" | "risk" | "unknown";

export interface Project {
  id: string;
  brand_name: string;
  entity_type: EntityType;
  region: string;
  language: string;
  categories: string; // JSON string[]
  audiences: string; // JSON string[]
  same_name_conflict: number; // 0/1
  same_name_note: string | null;
  status: "draft" | "setup" | "queries" | "evidence" | "analyzed";
  created_at: string;
  updated_at: string;
}

export interface OfficialAsset {
  id: string;
  project_id: string;
  url: string;
  platform: string;
  verified_by_user: number;
  created_at: string;
}

export interface GroundTruthFact {
  id: string;
  project_id: string;
  field: string;
  value: string;
  source_url: string | null;
  approved: number;
}

export interface QueryRow {
  id: string;
  project_id: string;
  text: string;
  type: QueryType;
  sub_category: string | null;
  importance: number; // 1-3
  created_by: "system" | "user";
  deleted: number;
  created_at: string;
}

export interface EvidenceRow {
  id: string;
  project_id: string;
  query_id: string;
  engine_label: string;
  response_text: string;
  status: "collected" | "not_found" | "collection_failed";
  entity_found: number | null;
  mention_type: MentionType | null;
  position: number | null;
  description_accuracy: number | null;
  conflicts: string | null; // JSON string[]
  source_types: string | null; // JSON string[]
  citations: string | null; // JSON string[] (urls)
  confidence: number | null;
  judged_at: string | null;
  is_sample: number;
  created_at: string;
}

export interface ReportRow {
  id: string;
  project_id: string;
  run_number: number;
  report_json: string;
  score_total: number;
  grade: string;
  trust_badge: "high" | "medium" | "low";
  created_at: string;
}

// ---- AI 프로필 허브 ----
export interface HubLink {
  label: string;
  url: string;
  platform: string;
  primary?: boolean;
}

export interface HubService {
  title: string;
  description: string;
}

export interface HubRow {
  id: string;
  project_id: string;
  slug: string;
  published: number; // 0/1
  display_name: string;
  headline: string;
  one_liner: string;
  bio: string;
  region: string;
  keywords: string; // JSON string[]
  audiences: string; // JSON string[]
  links: string; // JSON HubLink[]
  faq: string; // JSON {q,a}[]
  services: string; // JSON HubService[]
  contact_email: string | null;
  contact_note: string | null;
  accent: string;
  view_count: number;
  source_report_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** HubRow의 JSON 컬럼을 파싱한 형태. 화면·스키마 생성에서 사용한다. */
export interface Hub {
  id: string;
  project_id: string;
  slug: string;
  published: boolean;
  display_name: string;
  headline: string;
  one_liner: string;
  bio: string;
  region: string;
  keywords: string[];
  audiences: string[];
  links: HubLink[];
  faq: { q: string; a: string }[];
  services: HubService[];
  contact_email: string | null;
  contact_note: string | null;
  accent: string;
  view_count: number;
  source_report_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type HubInput = Partial<
  Pick<
    Hub,
    | "slug"
    | "published"
    | "display_name"
    | "headline"
    | "one_liner"
    | "bio"
    | "region"
    | "keywords"
    | "audiences"
    | "links"
    | "faq"
    | "services"
    | "contact_email"
    | "contact_note"
    | "accent"
    | "source_report_id"
  >
>;

export interface AxisScore {
  axis: "direct" | "recommend" | "accuracy" | "trust" | "consistency";
  label: string;
  max: number;
  raw: number;
  breakdown: { label: string; max: number; value: number }[];
  judgment: string;
}

export interface ReportJSON {
  summary: { one_line: string };
  score: {
    total: number;
    grade: string;
    grade_label: string;
    trust_badge: "high" | "medium" | "low";
    trust_label: string;
    sample_size: number;
    engine_count: number;
    failure_rate: number;
  };
  findings: { status: FindingStatus; title: string; detail: string; evidence_ids: string[] }[];
  entity: { keywords: string[]; audiences: string[]; official_assets: string[] };
  axes: AxisScore[];
  why_weak: string;
  actions: {
    priority: number;
    title: string;
    channel: string;
    rationale: string;
    copy: string;
    steps?: string[]; // 고객이 그대로 따라 할 수 있는 단계별 실행 가이드
  }[];
  copy_assets: {
    one_sentence: string;
    three_sentence: string;
    meta_description: string;
    common_profile: string;
    faq: { q: string; a: string }[];
  };
  /**
   * 30일 재점검 체크리스트 (PRD F7).
   * "확인해보세요"는 점검이 아니므로 항목마다 통과 기준을 반드시 갖는다.
   * 기준은 100% 재현이 아니라 `AI 3곳 중 2곳 이상`처럼 다수결로 느슨하게 잡는다 —
   * 생성형 답변은 매번 흔들려서 엄격하게 잡으면 개선됐는데도 실패로 읽힌다.
   */
  recheck_checklist?: { item: string; how: string; pass_criteria: string }[];
  limitations: string[];
}
