import { NextRequest, NextResponse } from "next/server";
import { deleteQuery, listQueries, updateQuery } from "@/lib/repo";
import { requireProject } from "@/lib/owner";

async function owned(id: string, qid: string): Promise<boolean> {
  if (!(await requireProject(id))) return false;
  // 이 진단의 질문만. 다른 진단의 질문 id 는 통하지 않는다.
  return listQueries(id).some((q) => q.id === qid);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; qid: string } }) {
  if (!(await owned(params.id, params.qid))) return NextResponse.json({ error: "not found" }, { status: 404 });
  const body = await req.json();
  updateQuery(params.qid, { text: body.text, importance: body.importance });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; qid: string } }) {
  if (!(await owned(params.id, params.qid))) return NextResponse.json({ error: "not found" }, { status: 404 });
  deleteQuery(params.qid);
  return NextResponse.json({ ok: true });
}
