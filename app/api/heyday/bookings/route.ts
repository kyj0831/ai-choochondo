import { NextRequest, NextResponse } from "next/server";
import { activityById, mateById } from "@/lib/heyday/data";
import { createBooking } from "@/lib/heyday/db";
import type { SlotKey } from "@/lib/heyday/types";

const SLOT_KEYS: SlotKey[] = ["morning", "afternoon", "evening"];

/** 숫자만 10~11자리인지. 010-1234-5678, 01012345678 모두 허용한다. */
function normalizePhone(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "");
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

/**
 * 예약 요청.
 *
 * 결제는 하지 않는다(PRD 9장). 여기서 남는 기록이
 * "5060이 실제로 돈을 쓸 의사가 있는가"에 대한 이번 MVP의 증거다.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "요청을 읽지 못했습니다." }, { status: 400 });
  }

  const mate = mateById(String(body.mateId ?? ""));
  const activity = activityById(String(body.activityId ?? ""));
  const guestName = String(body.guestName ?? "").trim();
  const phone = normalizePhone(body.guestPhone);
  const date = String(body.date ?? "");
  const slot = String(body.slot ?? "") as SlotKey;

  if (!mate || !activity) {
    return NextResponse.json({ error: "메이트 또는 활동 정보가 올바르지 않습니다." }, { status: 400 });
  }
  if (guestName.length < 1 || guestName.length > 30) {
    return NextResponse.json({ error: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "연락처를 다시 확인해 주세요." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !SLOT_KEYS.includes(slot)) {
    return NextResponse.json({ error: "날짜와 시간을 다시 골라주세요." }, { status: 400 });
  }

  // 가격과 소요 시간은 요청 본문이 아니라 서버의 Mate 정보에서 가져온다.
  const id = createBooking({
    sessionId: String(body.sessionId ?? "").slice(0, 64),
    mateId: mate.id,
    categoryId: activity.categoryId,
    activityId: activity.id,
    district: String(body.district ?? "").slice(0, 20),
    date,
    slot,
    durationMin: mate.durationMin,
    price: mate.price,
    guestName,
    guestPhone: phone,
    note: String(body.note ?? "").slice(0, 500) || undefined,
  });

  return NextResponse.json({ id });
}
