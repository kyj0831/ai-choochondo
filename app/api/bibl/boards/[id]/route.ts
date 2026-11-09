import { NextRequest, NextResponse } from "next/server";
import { deleteBoard, renameBoard } from "@/lib/bibl";
import { ownerHashOrNull } from "@/lib/biblOwner";
import { bad } from "@/lib/biblApi";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const owner = ownerHashOrNull();
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!owner || !name || !renameBoard(owner, params.id, name)) return bad("보드를 바꾸지 못했습니다.", 404);
  return NextResponse.json({ ok: true });
}

/** 보드를 지워도 그 안의 레퍼는 "보드 없음"으로 남는다. */
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const owner = ownerHashOrNull();
  if (!owner || !deleteBoard(owner, params.id)) return bad("보드를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
