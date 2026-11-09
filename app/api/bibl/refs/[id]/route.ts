import { NextRequest, NextResponse } from "next/server";
import { deleteRef, getRef, listBoards, listRemixes, updateRef } from "@/lib/bibl";
import { ownerHashOrNull } from "@/lib/biblOwner";
import { bad } from "@/lib/biblApi";

export const dynamic = "force-dynamic";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const owner = ownerHashOrNull();
  const ref = owner ? getRef(owner, params.id) : undefined;
  if (!owner || !ref) return bad("레퍼를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ref, remixes: listRemixes(ref.id), boards: listBoards(owner) });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const owner = ownerHashOrNull();
  if (!owner) return bad("레퍼를 찾을 수 없습니다.", 404);
  const body = await req.json().catch(() => ({}));
  const ref = updateRef(owner, params.id, {
    note: typeof body.note === "string" ? body.note : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : undefined,
    boardId: body.boardId === null || typeof body.boardId === "string" ? body.boardId : undefined,
  });
  if (!ref) return bad("레퍼를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ref });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const owner = ownerHashOrNull();
  if (!owner || !deleteRef(owner, params.id)) return bad("레퍼를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
