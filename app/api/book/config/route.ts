import { NextResponse } from "next/server";
import { getBookingConfig } from "@/lib/booking/config";
import { calendarMode } from "@/lib/booking/slots";

export const dynamic = "force-dynamic";

/** 예약 화면이 처음 읽는 공개 설정. 캘린더 ID 같은 내부 값은 내보내지 않는다. */
export async function GET() {
  const cfg = getBookingConfig();
  return NextResponse.json({
    host: cfg.host,
    hostTimeZone: cfg.hostTimeZone,
    durations: cfg.durations,
    maxDaysAhead: cfg.maxDaysAhead,
    offlineLocation: cfg.offlineLocation,
    mode: calendarMode(),
  });
}
