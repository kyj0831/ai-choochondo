import { NextRequest, NextResponse } from "next/server";
import { getProject, listEvidence, listQueries, updateProjectStatus } from "@/lib/repo";
import { configuredEngines } from "@/lib/engines";
import { runAutoProbeForQuery, ProbeOutcome } from "@/lib/autoProbe";

// 질문 N개 × 엔진 M개를 배치로 처리하므로 몇 분 걸릴 수 있다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// 한 번에 너무 많은 질문을 동시에 쏘면 엔진별 rate limit에 걸리기 쉽다.
// 질문 단위로 묶어 배치 처리한다(질문 하나당 이미 엔진 수만큼 동시 호출이 나간다).
const BATCH_SIZE = 3;

/**
 * 아직 증거가 없는 모든 질문에 대해 설정된 엔진을 자동으로 돌린다.
 * 이미 증거가 있는 질문은 건드리지 않는다 — 중복 호출로 비용이 새는 것을 막기 위함.
 * 특정 질문을 다시 돌리고 싶으면 그 질문의 기존 증거를 지운 뒤 다시 호출하거나,
 * 질문별 자동 수집(auto-probe) 엔드포인트를 쓴다.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });

  const engines = configuredEngines();
  if (engines.length === 0) {
    return NextResponse.json(
      {
        error:
          "자동 수집을 쓰려면 엔진 API 키가 최소 1개 필요합니다. .env.local에 OPENAI_API_KEY / ANTHROPIC_API_KEY / GEMINI_API_KEY / PERPLEXITY_API_KEY 중 하나 이상을 넣고 서버를 재시작하세요.",
      },
      { status: 400 }
    );
  }

  const queries = listQueries(params.id);
  const alreadyHas = new Set(listEvidence(params.id).map((e) => e.query_id));
  const targets = queries.filter((q) => !alreadyHas.has(q.id));

  if (targets.length === 0) {
    return NextResponse.json({ message: "이미 모든 질문에 증거가 있습니다.", processed: 0, engines });
  }

  const perQuery: Record<string, ProbeOutcome[]> = {};
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map((q) => runAutoProbeForQuery(params.id, q)));
    batch.forEach((q, idx) => {
      perQuery[q.id] = batchResults[idx];
    });
  }

  updateProjectStatus(params.id, "evidence");
  return NextResponse.json({ processed: targets.length, engines, perQuery });
}
