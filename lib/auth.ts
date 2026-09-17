/**
 * 접근 제한용 토큰.
 * middleware(Edge)와 API 라우트(Node) 양쪽에서 쓰이므로
 * Web Crypto API만 사용해 런타임에 무관하게 동작하도록 한다.
 */

export const AUTH_COOKIE = "ai_choochondo_auth";

/** 쿠키에 저장할 값. 비밀번호를 그대로 담지 않기 위해 해시를 쓴다. */
export async function authToken(password: string): Promise<string> {
  const secret = process.env.AUTH_SECRET || "ai-choochondo";
  const data = new TextEncoder().encode(`${password}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 인증 없이 접근 가능한 경로.
 * AI 프로필 허브(/p/*)와 robots/sitemap은 반드시 공개여야 한다 —
 * AI 크롤러가 읽어가는 것이 그 페이지의 존재 이유이기 때문이다.
 *
 * HeyDay(/heyday)도 공개다. 실제 5060 사용자에게 링크를 보내 반응을 보는 것이
 * 그 MVP의 목적이므로, 비밀번호 화면이 앞을 막으면 검증 자체가 불가능하다.
 * 단 검증 결과 화면(/heyday/insights)에는 요청자 연락처가 들어 있어 제외한다.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/heyday/insights") return false;
  return (
    pathname === "/heyday" ||
    pathname.startsWith("/heyday/") ||
    pathname.startsWith("/api/heyday/") ||
    pathname.startsWith("/p/") || // 허브 페이지 및 llms.txt
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  );
}
