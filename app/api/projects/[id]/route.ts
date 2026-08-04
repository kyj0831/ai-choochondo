import { NextRequest, NextResponse } from "next/server";
import { getProject, listAssets, listFacts, listQueries, listEvidence, updateProjectMeta, getLatestReport } from "@/lib/repo";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    project,
    assets: listAssets(params.id),
    facts: listFacts(params.id),
    queries: listQueries(params.id),
    evidence: listEvidence(params.id),
    latestReport: getLatestReport(params.id) || null,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  updateProjectMeta(params.id, {
    categories: body.categories,
    audiences: body.audiences,
    same_name_conflict: body.same_name_conflict !== undefined ? (body.same_name_conflict ? 1 : 0) : undefined,
    same_name_note: body.same_name_note,
  });
  return NextResponse.json({ project: getProject(params.id) });
}
