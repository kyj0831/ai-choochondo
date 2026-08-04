import { NextRequest, NextResponse } from "next/server";
import {
  availableSlug,
  createHub,
  crawlSummary,
  getHubByProject,
  getLatestReport,
  getProject,
  isSlugTaken,
  listAssets,
  listCrawls,
  listEvidence,
  listQueries,
  listReports,
  normalizeSlug,
  updateHub,
} from "@/lib/repo";
import { canPublish, draftFromReport, hubReadiness } from "@/lib/hub";
import { measureHubEffect } from "@/lib/hubEffect";
import { ReportJSON } from "@/lib/types";

/** 진단에서 브랜드가 추천 후보로 등장하지 못한 범주형 질문 목록. FAQ 질문 후보로 쓴다. */
function missedRecommendQueries(projectId: string): string[] {
  const queries = listQueries(projectId).filter((q) => q.type === "recommend" || q.type === "situational");
  const evidence = listEvidence(projectId);

  return queries
    .filter((q) => {
      const rows = evidence.filter((e) => e.query_id === q.id);
      if (rows.length === 0) return false;
      // 수집 실패는 미노출이 아니므로 제외한다.
      const usable = rows.filter((e) => e.status !== "collection_failed");
      if (usable.length === 0) return false;
      return !usable.some((e) => e.mention_type === "recommended_candidate");
    })
    .map((q) => q.text);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const hub = getHubByProject(params.id);
  if (!hub) {
    return NextResponse.json({ hub: null, missedQueries: missedRecommendQueries(params.id) });
  }

  const summary = crawlSummary(hub.id);
  const recent = listCrawls(hub.id, 30);
  const queryTextById = Object.fromEntries(listQueries(params.id).map((q) => [q.id, q.text]));

  const effect = measureHubEffect({
    hub,
    reports: listReports(params.id),
    evidence: listEvidence(params.id),
    queryTextById,
    crawl: {
      total: summary.total,
      operators: summary.byOperator.map((o) => o.operator),
      firstSeen: recent.length ? recent[recent.length - 1].created_at : null,
    },
  });

  return NextResponse.json({
    hub,
    readiness: hubReadiness(hub),
    publishCheck: canPublish(hub),
    crawls: { summary, recent },
    effect,
    missedQueries: missedRecommendQueries(params.id),
  });
}

/** 최신 리포트를 근거로 허브 초안을 생성한다. 이미 있으면 그대로 돌려준다. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const existing = getHubByProject(params.id);
  if (existing) return NextResponse.json({ hub: existing, created: false });

  const reportRow = getLatestReport(params.id);
  let report: ReportJSON | null = null;
  if (reportRow) {
    try {
      report = JSON.parse(reportRow.report_json) as ReportJSON;
    } catch {
      report = null;
    }
  }

  const draft = draftFromReport(
    project,
    listAssets(params.id),
    report,
    reportRow?.id ?? null,
    missedRecommendQueries(params.id)
  );

  const hub = createHub(params.id, { ...draft, slug: availableSlug(project.brand_name) });
  return NextResponse.json({ hub, created: true });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const hub = getHubByProject(params.id);
  if (!hub) return NextResponse.json({ error: "hub not found" }, { status: 404 });

  const body = await req.json();

  if (body.slug !== undefined) {
    const slug = normalizeSlug(body.slug);
    if (!slug) return NextResponse.json({ error: "주소는 영문/숫자/한글로 1자 이상이어야 합니다." }, { status: 400 });
    if (isSlugTaken(slug, hub.id)) {
      return NextResponse.json({ error: "이미 사용 중인 주소입니다." }, { status: 409 });
    }
    body.slug = slug;
  }

  // 발행은 초안 문구가 남아 있거나 빈 항목이 있으면 막는다.
  if (body.published === true) {
    const merged = { ...hub, ...body };
    const check = canPublish(merged);
    if (!check.ok) {
      return NextResponse.json({ error: "아직 발행할 수 없습니다.", blockers: check.blockers }, { status: 400 });
    }
  }

  const updated = updateHub(hub.id, body);
  if (!updated) return NextResponse.json({ error: "hub not found" }, { status: 404 });

  return NextResponse.json({
    hub: updated,
    readiness: hubReadiness(updated),
    publishCheck: canPublish(updated),
  });
}
