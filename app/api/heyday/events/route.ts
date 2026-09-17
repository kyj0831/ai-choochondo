import { NextRequest, NextResponse } from "next/server";
import { logEvent } from "@/lib/heyday/db";

/**
 * 화면 도달 기록.
 *
 * 받는 것은 브라우저가 만든 임의 식별자와 화면 이름뿐이다.
 * 실패해도 200을 돌려준다 — 기록이 안 됐다고 사용자의 예약이 막히면 안 된다.
 */
export async function POST(req: NextRequest) {
  try {
    const { sessionId, name, props } = await req.json();
    if (typeof name === "string" && name.length > 0 && name.length <= 64) {
      logEvent(String(sessionId ?? "anon").slice(0, 64), name, props);
    }
  } catch {
    /* 잘못된 본문은 조용히 버린다 */
  }
  return NextResponse.json({ ok: true });
}
