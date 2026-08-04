import { EvidenceRow, Hub, ReportJSON, ReportRow } from "./types";

/**
 * 허브 효과 측정.
 *
 * 프로필 페이지만 파는 서비스는 "그래서 효과가 있었나"에 답할 수 없다.
 * 우리는 진단 엔진을 이미 갖고 있으므로 루프를 닫을 수 있다:
 *
 *   발행 → AI 크롤러가 수집 → AI 답변이 허브를 인용 → 노출·정확도 점수 상승
 *
 * 각 단계를 별도 지표로 관측하고, 근거 없이 인과를 단정하지 않는다.
 */

export interface AxisDelta {
  axis: string;
  label: string;
  before: number;
  after: number;
  max: number;
  delta: number;
}

export interface CitationAdoption {
  /** 허브 URL을 인용한 증거 수 */
  citedCount: number;
  /** 발행 이후 수집된 증거 수 */
  totalAfter: number;
  /** 허브를 인용한 엔진 목록 */
  engines: string[];
  /** 허브를 인용한 질문 텍스트 (최대 5개) */
  sampleQueries: string[];
}

export interface HubEffect {
  stage: "not_published" | "awaiting_crawl" | "crawled" | "cited" | "measured";
  headline: string;
  detail: string;
  publishedAt: string | null;
  score: { before: number; after: number; delta: number } | null;
  axes: AxisDelta[];
  citation: CitationAdoption;
  crawl: { total: number; operators: string[]; firstSeen: string | null };
}

function parseCitations(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** 인용 URL이 이 허브를 가리키는지 판정한다. 도메인이 달라도 슬러그 경로로 확인한다. */
function citesHub(citation: string, slug: string): boolean {
  const needle = `/p/${slug}`;
  return citation.includes(needle);
}

export function measureHubEffect(args: {
  hub: Hub;
  reports: ReportRow[];
  evidence: EvidenceRow[];
  queryTextById: Record<string, string>;
  crawl: { total: number; operators: string[]; firstSeen: string | null };
}): HubEffect {
  const { hub, reports, evidence, queryTextById, crawl } = args;

  const empty: HubEffect = {
    stage: "not_published",
    headline: "아직 발행되지 않았습니다",
    detail: "허브를 발행하면 AI 크롤러 수집·인용·점수 변화를 추적합니다.",
    publishedAt: null,
    score: null,
    axes: [],
    citation: { citedCount: 0, totalAfter: 0, engines: [], sampleQueries: [] },
    crawl,
  };

  if (!hub.published || !hub.published_at) return empty;

  const publishedAt = hub.published_at;

  // 기준선: 발행 시점 이전의 마지막 리포트. 이후: 발행 이후의 마지막 리포트.
  const sorted = [...reports].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const before = [...sorted].reverse().find((r) => r.created_at <= publishedAt) ?? null;
  const after = [...sorted].reverse().find((r) => r.created_at > publishedAt) ?? null;

  // 인용 채택: 발행 이후 수집된 증거 중 허브 URL을 근거로 든 것
  const afterEvidence = evidence.filter((e) => e.created_at > publishedAt);
  const cited = afterEvidence.filter((e) =>
    parseCitations(e.citations).some((c) => citesHub(c, hub.slug))
  );

  const citation: CitationAdoption = {
    citedCount: cited.length,
    totalAfter: afterEvidence.length,
    engines: Array.from(new Set(cited.map((e) => e.engine_label))),
    sampleQueries: Array.from(
      new Set(cited.map((e) => queryTextById[e.query_id]).filter(Boolean))
    ).slice(0, 5),
  };

  let axes: AxisDelta[] = [];
  let score: HubEffect["score"] = null;

  if (before && after) {
    score = {
      before: before.score_total,
      after: after.score_total,
      delta: Math.round((after.score_total - before.score_total) * 10) / 10,
    };

    try {
      const b = JSON.parse(before.report_json) as ReportJSON;
      const a = JSON.parse(after.report_json) as ReportJSON;
      axes = a.axes.map((ax) => {
        const prev = b.axes.find((x) => x.axis === ax.axis);
        return {
          axis: ax.axis,
          label: ax.label,
          before: prev?.raw ?? 0,
          after: ax.raw,
          max: ax.max,
          delta: Math.round((ax.raw - (prev?.raw ?? 0)) * 10) / 10,
        };
      });
    } catch {
      axes = [];
    }
  }

  // 단계 판정 — 관측된 사실만으로 결정한다.
  let stage: HubEffect["stage"] = "awaiting_crawl";
  let headline = "AI 크롤러 수집을 기다리는 중";
  let detail = "발행 직후에는 수집까지 며칠에서 몇 주가 걸립니다. 이 기간에도 채널 문구를 통일해 두세요.";

  if (score) {
    stage = "measured";
    const dir = score.delta >= 0 ? "상승" : "하락";
    headline = `발행 후 재진단: ${score.before}점 → ${score.after}점 (${score.delta >= 0 ? "+" : ""}${score.delta})`;
    detail =
      citation.citedCount > 0
        ? `AI 답변 ${citation.citedCount}건이 허브를 근거로 인용했고, 총점은 ${Math.abs(score.delta)}점 ${dir}했습니다.`
        : `총점이 ${Math.abs(score.delta)}점 ${dir}했습니다. 아직 허브가 인용 출처로 잡히지는 않았습니다.`;
  } else if (citation.citedCount > 0) {
    stage = "cited";
    headline = `AI가 허브를 근거로 인용하기 시작했습니다 (${citation.citedCount}건)`;
    detail = "이제 재진단을 실행하면 인용이 점수에 어떻게 반영됐는지 확인할 수 있습니다.";
  } else if (crawl.total > 0) {
    stage = "crawled";
    headline = `${crawl.operators.join(", ")}가 허브를 읽어갔습니다`;
    detail = "수집은 확인됐습니다. 답변에 반영되기까지 시간이 더 걸립니다. 1~4주 뒤 재진단을 권합니다.";
  }

  return { stage, headline, detail, publishedAt, score, axes, citation, crawl };
}

export const STAGE_STEPS: { key: HubEffect["stage"]; label: string }[] = [
  { key: "not_published", label: "발행" },
  { key: "awaiting_crawl", label: "수집 대기" },
  { key: "crawled", label: "AI 수집 확인" },
  { key: "cited", label: "답변에 인용" },
  { key: "measured", label: "점수 변화 측정" },
];
