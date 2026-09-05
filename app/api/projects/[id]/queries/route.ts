import { NextRequest, NextResponse } from "next/server";
import { clearSystemQueries, getProject, insertQueries, listQueries, updateProjectStatus } from "@/lib/repo";
import { generateQueries } from "@/lib/llm";
import { describeLlmError } from "@/lib/openai";
import { EntityType } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ queries: listQueries(params.id) });
}

// Generate query set via LLM (FR-010)
// body.replace=true면 기존 시스템 생성 질문을 먼저 비운다.
// 없으면 재생성할 때마다 질문이 누적되어 질의군 커버리지 점수가 왜곡된다.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  try {
    const generated = await generateQueries({
      brandName: project.brand_name,
      entityType: project.entity_type as EntityType,
      region: project.region,
      language: project.language,
      categories: JSON.parse(project.categories),
      audiences: JSON.parse(project.audiences),
    });
    // 사용자가 직접 추가·수정한 질문은 남기고 시스템 생성분만 비운다.
    if (body.replace) clearSystemQueries(params.id);

    const rows = insertQueries(
      params.id,
      generated.map((q) => ({
        text: q.text,
        type: q.type,
        sub_category: q.sub_category,
        importance: q.importance,
        created_by: "system" as const,
      }))
    );
    updateProjectStatus(params.id, "queries");
    return NextResponse.json({ queries: rows });
  } catch (e: unknown) {
    // describeLlmError를 거쳐야 401·크레딧 소진 같은 원인이 한국어 조치사항으로 나온다.
    // 원문 메시지를 그대로 내보내면 화면에 영어 스택이 뜨고 사용자는 손쓸 방법이 없다.
    const message = e instanceof Error ? describeLlmError(e) : "질문 생성 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Add a single user-authored query
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  if (!body.text || !body.type) return NextResponse.json({ error: "text, type은 필수입니다." }, { status: 400 });
  const rows = insertQueries(params.id, [
    { text: body.text, type: body.type, sub_category: body.sub_category || null, importance: body.importance || 2, created_by: "user" },
  ]);
  return NextResponse.json({ queries: rows });
}
