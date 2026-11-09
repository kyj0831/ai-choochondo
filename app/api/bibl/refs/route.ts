import { NextRequest, NextResponse } from "next/server";
import { createBoard, listBoards, listRefs, saveRef } from "@/lib/bibl";
import { ownerHashOrNull, resolveOwner, setKeyCookie } from "@/lib/biblOwner";
import { bad, parseVideo } from "@/lib/biblApi";

export const dynamic = "force-dynamic";

export async function GET() {
  const owner = ownerHashOrNull();
  if (!owner) return NextResponse.json({ refs: [], boards: [] });
  return NextResponse.json({ refs: listRefs(owner), boards: listBoards(owner) });
}

/** 레퍼 저장. 처음 저장하는 브라우저에는 보관함 열쇠를 발급한다. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const video = parseVideo(body?.video);
  if (!video) return bad("영상 정보가 올바르지 않습니다.");
  if (video.id.startsWith("demo-")) return bad("샘플(데모) 영상은 저장할 수 없습니다. YouTube API 키를 넣고 실제 영상을 검색하세요.");

  const { key, hash, issued } = resolveOwner();
  let boardId: string | null = typeof body?.boardId === "string" ? body.boardId : null;
  if (typeof body?.newBoardName === "string" && body.newBoardName.trim()) {
    boardId = createBoard(hash, body.newBoardName).id;
  }
  const ref = saveRef(hash, {
    video,
    boardId,
    note: typeof body?.note === "string" ? body.note : "",
    tags: Array.isArray(body?.tags) ? body.tags.filter((t: unknown) => typeof t === "string") : [],
  });
  const res = NextResponse.json({ ref });
  if (issued) setKeyCookie(res, key);
  return res;
}
