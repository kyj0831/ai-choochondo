import { NextRequest, NextResponse } from "next/server";
import { getRef, setAnalysis } from "@/lib/bibl";
import { analyzeVideo } from "@/lib/biblAi";
import { ownerHashOrNull } from "@/lib/biblOwner";
import { aiError, bad } from "@/lib/biblApi";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 썸네일·제목 해부. 결과는 저장해 두고 다시 부르지 않는다(refresh=1이면 다시). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const owner = ownerHashOrNull();
  const ref = owner ? getRef(owner, params.id) : undefined;
  if (!owner || !ref) return bad("레퍼를 찾을 수 없습니다.", 404);
  if (ref.analysis && req.nextUrl.searchParams.get("refresh") !== "1") return NextResponse.json({ analysis: ref.analysis });
  try {
    const analysis = await analyzeVideo(ref.video);
    setAnalysis(owner, ref.id, analysis);
    return NextResponse.json({ analysis });
  } catch (e) {
    return aiError(e);
  }
}
