import { NextResponse } from "next/server";
import { getProvider } from "@/lib/openai";
import { storageInfo } from "@/lib/db";

// 저장 상태는 매 요청 시점의 사실이어야 한다. 캐시된 값으로 "데이터 있음"을 보여주면
// 정작 날아간 상황을 못 잡는다.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ provider: getProvider(), storage: storageInfo() });
}
