import { NextRequest, NextResponse } from "next/server";
import { createBoard } from "@/lib/bibl";
import { resolveOwner, setKeyCookie } from "@/lib/biblOwner";
import { bad } from "@/lib/biblApi";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return bad("보드 이름을 입력하세요.");
  const { key, hash, issued } = resolveOwner();
  const res = NextResponse.json({ board: createBoard(hash, name) });
  if (issued) setKeyCookie(res, key);
  return res;
}
