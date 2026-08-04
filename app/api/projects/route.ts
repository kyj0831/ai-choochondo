import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/repo";

export async function GET() {
  const projects = listProjects();
  return NextResponse.json({ projects });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { brand_name, entity_type, region, language, categories, audiences } = body;
  if (!brand_name || !entity_type || !region) {
    return NextResponse.json({ error: "brand_name, entity_type, region은 필수입니다." }, { status: 400 });
  }
  const project = createProject({
    brand_name,
    entity_type,
    region,
    language: language || "한국어",
    categories: categories || [],
    audiences: audiences || [],
  });
  return NextResponse.json({ project });
}
