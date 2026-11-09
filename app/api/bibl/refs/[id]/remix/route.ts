import { NextRequest, NextResponse } from "next/server";
import { addRemix, getRef } from "@/lib/bibl";
import { remixForMe } from "@/lib/biblAi";
import { ownerHashOrNull } from "@/lib/biblOwner";
import { aiError, bad } from "@/lib/biblApi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 내 버전 만들기 — 레퍼의 구조로 내 주제의 제목 5안·썸네일 3안. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const owner = ownerHashOrNull();
  const ref = owner ? getRef(owner, params.id) : undefined;
  if (!owner || !ref) return bad("레퍼를 찾을 수 없습니다.", 404);
  const body = await req.json().catch(() => ({}));
  const topic = typeof body.topic === "string" ? body.topic.trim().slice(0, 100) : "";
  if (!topic) return bad("내 영상 주제를 입력하세요.");
  try {
    const result = await remixForMe(ref.video, ref.analysis, topic);
    return NextResponse.json({ remix: addRemix(ref.id, topic, result) });
  } catch (e) {
    return aiError(e);
  }
}
