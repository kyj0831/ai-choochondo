import { NextRequest, NextResponse } from "next/server";
import { getProject, insertQueries, listQueries, updateProjectStatus } from "@/lib/repo";
import { generateQueries } from "@/lib/llm";
import { EntityType } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ queries: listQueries(params.id) });
}

// Generate query set via LLM (FR-010)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  try {
    const generated = await generateQueries({
      brandName: project.brand_name,
      entityType: project.entity_type as EntityType,
      region: project.region,
      language: project.language,
      categories: JSON.parse(project.categories),
      audiences: JSON.parse(project.audiences),
    });
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
    const message = e instanceof Error ? e.message : "질문 생성 중 오류가 발생했습니다.";
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
