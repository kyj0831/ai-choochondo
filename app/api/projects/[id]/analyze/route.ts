import { NextRequest, NextResponse } from "next/server";
import { getProject, listAssets, listEvidence, listFacts, listQueries, saveReport, updateProjectStatus } from "@/lib/repo";
import { computeScores } from "@/lib/scoring";
import { assembleReportJSON, generateReportNarrative } from "@/lib/llm";
import { EntityType } from "@/lib/types";

// Compute deterministic 5-axis scores, then ask the LLM to write the narrative
// portions (findings, actions, copy) grounded in those scores. FR-032/033/040/042.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const queries = listQueries(params.id);
  const evidence = listEvidence(params.id);
  const assets = listAssets(params.id);

  if (queries.length === 0) {
    return NextResponse.json({ error: "질문 세트가 없습니다. 먼저 질문을 생성하세요." }, { status: 400 });
  }
  const judgedCount = evidence.filter((e) => e.judged_at).length;
  if (judgedCount === 0) {
    return NextResponse.json({ error: "분석할 증거가 없습니다. 최소 1개 이상의 AI 답변을 제출하세요." }, { status: 400 });
  }

  const scoring = computeScores({
    queries,
    evidence,
    officialAssetCount: assets.length,
    hasStructuredData: false,
    lastActivityWithinDays: null,
    hasSameNameConflictFlag: !!project.same_name_conflict,
  });

  try {
    const narrative = await generateReportNarrative({
      brandName: project.brand_name,
      entityType: project.entity_type as EntityType,
      region: project.region,
      categories: JSON.parse(project.categories),
      audiences: JSON.parse(project.audiences),
      officialAssets: assets.map((a) => a.url),
      axes: scoring.axes,
      total: scoring.total,
      grade: scoring.grade,
      gradeLabel: scoring.gradeLabel,
      queries,
      evidence,
      groundTruth: listFacts(params.id)
        .filter((f) => f.approved)
        .map((f) => ({ field: f.field, value: f.value })),
    });

    const reportJson = assembleReportJSON({
      brandName: project.brand_name,
      categories: JSON.parse(project.categories),
      audiences: JSON.parse(project.audiences),
      officialAssets: assets.map((a) => a.url),
      axes: scoring.axes,
      total: scoring.total,
      grade: scoring.grade,
      gradeLabel: scoring.gradeLabel,
      trustBadge: scoring.trustBadge,
      trustLabel: scoring.trustLabel,
      sampleSize: scoring.sampleSize,
      engineCount: scoring.engineCount,
      failureRate: scoring.failureRate,
      narrative,
    });

    const report = saveReport(params.id, reportJson, scoring.total, scoring.grade, scoring.trustBadge);
    updateProjectStatus(params.id, "analyzed");
    return NextResponse.json({ report });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "리포트 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
