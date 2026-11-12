import { NextRequest, NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/booking/rateLimit";
import { z } from "zod";
import { getBookingConfig } from "@/lib/booking/config";
import { availableSlots } from "@/lib/booking/slots";
import { suggestSlots } from "@/lib/booking/ai";
import { isValidTimeZone } from "@/lib/booking/time";

export const dynamic = "force-dynamic";

const Body = z.object({
  text: z.string().trim().min(1).max(300),
  duration: z.number().int(),
  timeZone: z.string().refine(isValidTimeZone),
});

/** "다음 주 화요일 오후 괜찮아요" → 빈 슬롯 중 추천 */
export async function POST(req: NextRequest) {
  if (!allow(`suggest:${clientIp(req)}`, 20, 3600_000)) {
    return NextResponse.json({ error: "요청이 너무 많습니다. 달력에서 직접 골라 주세요." }, { status: 429 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const { text, duration, timeZone } = parsed.data;
  const cfg = getBookingConfig();
  if (!cfg.durations.includes(duration)) {
    return NextResponse.json({ error: "지원하지 않는 미팅 시간입니다." }, { status: 400 });
  }
  try {
    const now = new Date();
    const slots = await availableSlots(now, new Date(now.getTime() + cfg.maxDaysAhead * 86400_000), duration, now);
    return NextResponse.json(await suggestSlots(text, slots, timeZone, now));
  } catch (e) {
    console.error("[book] suggest", e);
    return NextResponse.json({ error: "추천 중 오류가 발생했습니다." }, { status: 502 });
  }
}
