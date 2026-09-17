import { NextRequest, NextResponse } from "next/server";
import { getBooking, setReuseIntent } from "@/lib/heyday/db";

/**
 * 재이용 의향 기록.
 * PRD 17장 Retention 가설에 답하려면 "또 부르겠는가"를 한 번은 물어야 한다.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => null);
  const intent = body?.reuseIntent;
  if (intent !== "yes" && intent !== "maybe" && intent !== "no") {
    return NextResponse.json({ error: "값이 올바르지 않습니다." }, { status: 400 });
  }
  if (!getBooking(params.id)) {
    return NextResponse.json({ error: "예약을 찾을 수 없습니다." }, { status: 404 });
  }
  setReuseIntent(params.id, intent);
  return NextResponse.json({ ok: true });
}
