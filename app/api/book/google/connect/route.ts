import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl, hasOAuthClient, isGoogleConnected } from "@/lib/booking/google";
import { redirectUri, setupAllowed } from "../shared";

export const dynamic = "force-dynamic";

/**
 * 호스트가 자기 Google 캘린더를 연결하는 입구.
 * BOOKING_ADMIN_KEY를 정했다면 ?key=... 로만 열린다.
 * 정하지 않았다면 "아직 아무 캘린더도 연결 안 된 상태"에서 한 번만 열린다 —
 * 그래야 배포 후 아무나 자기 캘린더로 바꿔치기할 수 없다.
 */
export async function GET(req: NextRequest) {
  if (!hasOAuthClient()) {
    return new NextResponse(
      "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET 이 설정되지 않았습니다. docs/booking.md 를 참고하세요.",
      { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } }
    );
  }
  if (!setupAllowed(req, isGoogleConnected())) {
    return new NextResponse("권한이 없습니다. ?key=BOOKING_ADMIN_KEY 를 붙여 여세요.", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(redirectUri(req), state));
  res.cookies.set("book_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    maxAge: 600,
    path: "/api/book/google",
  });
  return res;
}
