import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authToken, isPublicPath } from "@/lib/auth";

/**
 * 접근 제한.
 *
 * 진단 데이터(프로젝트·증거·리포트)는 고객 정보이므로 보호한다.
 * 반면 AI 프로필 허브(/p/*)는 공개로 둔다 — AI 크롤러가 읽어가야 하기 때문이다.
 *
 * APP_PASSWORD가 없으면 게이트를 끈다(로컬 개발 편의).
 * 배포 환경에서는 반드시 설정할 것.
 */
export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const expected = await authToken(password);
  if (req.cookies.get(AUTH_COOKIE)?.value === expected) return NextResponse.next();

  // API 요청은 리다이렉트 대신 401을 준다.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
