import { NextRequest, NextResponse } from "next/server";
import { deleteQuery, updateQuery } from "@/lib/repo";

export async function PATCH(req: NextRequest, { params }: { params: { qid: string } }) {
  const body = await req.json();
  updateQuery(params.qid, { text: body.text, importance: body.importance });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { qid: string } }) {
  deleteQuery(params.qid);
  return NextResponse.json({ ok: true });
}
