import { NextRequest, NextResponse } from "next/server";
import { getProject, listQueries, updateProjectStatus } from "@/lib/repo";
import { configuredEngines } from "@/lib/engines";
import { runAutoProbeForQuery } from "@/lib/autoProbe";

// 여러 엔진 API를 순차·병렬 호출하므로 수 초~수십 초 걸릴 수 있다.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 질문 하나에 대해 설정된 모든 엔진(API 키가 있는 것만)을 자동으로 호출해 증거를 채운다. */
export async function POST(_req: NextRequest, { params }: { params: { id: string; qid: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });

  const query = listQueries(params.id).find((q) => q.id === params.qid);
  if (!query) return NextResponse.json({ error: "질문을 찾을 수 없습니다." }, { status: 404 });

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

  const results = await runAutoProbeForQuery(params.id, query);
  updateProjectStatus(params.id, "evidence");
  return NextResponse.json({ results });
}
