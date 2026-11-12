import { NextRequest, NextResponse } from "next/server";
import { getBookingConfig } from "@/lib/booking/config";
import { availableSlots, calendarMode } from "@/lib/booking/slots";

export const dynamic = "force-dynamic";

/** GET /api/book/availability?start=ISO&end=ISO&duration=30 → { slots: ISO[] } */
export async function GET(req: NextRequest) {
  const cfg = getBookingConfig();
  const sp = req.nextUrl.searchParams;
  const duration = Number(sp.get("duration") || cfg.durations[0]);
  if (!cfg.durations.includes(duration)) {
    return NextResponse.json({ error: "지원하지 않는 미팅 시간입니다." }, { status: 400 });
  }
  const start = new Date(sp.get("start") || Date.now());
  const end = new Date(sp.get("end") || Date.now() + 31 * 86400_000);
  if (isNaN(+start) || isNaN(+end) || end <= start || +end - +start > 62 * 86400_000) {
    return NextResponse.json({ error: "기간이 올바르지 않습니다." }, { status: 400 });
  }
  try {
    const slots = await availableSlots(start, end, duration);
    return NextResponse.json({ slots, mode: calendarMode() });
  } catch (e) {
    console.error("[book] availability", e);
    return NextResponse.json(
      { error: "캘린더를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 }
    );
  }
}
