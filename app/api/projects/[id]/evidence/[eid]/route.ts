import { NextRequest, NextResponse } from "next/server";
import { deleteEvidence, listEvidence } from "@/lib/repo";
import { requireProject } from "@/lib/owner";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; eid: string } }) {
  if (!(await requireProject(params.id))) return NextResponse.json({ error: "not found" }, { status: 404 });
  // 이 진단에 속한 증거만. 경로의 진단 id 와 증거 id 가 서로 맞아야 한다.
  if (!listEvidence(params.id).some((e) => e.id === params.eid)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  deleteEvidence(params.eid);
  return NextResponse.json({ ok: true });
}
