import { NextResponse } from "next/server";
import { savedVideoIds } from "@/lib/bibl";
import { ownerHashOrNull } from "@/lib/biblOwner";

export const dynamic = "force-dynamic";

/** 검색 결과에 "저장됨"을 표시하기 위한 영상 ID → 레퍼 ID 목록. */
export async function GET() {
  const owner = ownerHashOrNull();
  return NextResponse.json({ saved: owner ? savedVideoIds(owner) : {} });
}
