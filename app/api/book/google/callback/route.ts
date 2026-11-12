import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, hasOAuthClient, saveGoogleConnection } from "@/lib/booking/google";
import { redirectUri } from "../shared";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function page(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="background:#0a0a0c;color:#e5e5e5;font-family:-apple-system,'Apple SD Gothic Neo',sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px">
<div style="max-width:440px;text-align:center"><h1 style="font-size:22px">${title}</h1><p style="color:#a3a3a3;line-height:1.6">${body}</p>
<p><a href="/book" style="color:#80d97b">예약 페이지로 이동 →</a></p></div></body>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: NextRequest) {
  if (!hasOAuthClient()) return page("설정 필요", "OAuth 클라이언트가 설정되지 않았습니다.", 400);
  const sp = req.nextUrl.searchParams;
  const state = sp.get("state");
  const saved = req.cookies.get("book_oauth_state")?.value;
  if (!state || !saved || state !== saved) {
    return page("연결 실패", "요청이 만료됐거나 올바르지 않습니다. 연결을 처음부터 다시 시도해 주세요.", 400);
  }
  if (sp.get("error")) return page("연결 취소", "Google 권한 허용이 취소됐습니다.", 400);
  const code = sp.get("code");
  if (!code) return page("연결 실패", "인증 코드가 없습니다.", 400);

  try {
    const { refreshToken, email } = await exchangeCode(code, redirectUri(req));
    if (!refreshToken) {
      return page(
        "연결 실패",
        "Google이 리프레시 토큰을 주지 않았습니다. Google 계정 → 보안 → 타사 앱 액세스에서 이 앱 권한을 삭제한 뒤 다시 연결해 주세요.",
        400
      );
    }
    saveGoogleConnection(refreshToken, email);
    const res = page("캘린더 연결 완료", `${email ? `<b>${esc(email)}</b> 캘린더가 ` : "캘린더가 "}연결됐습니다. 이제 예약 페이지에 실제 빈 시간이 표시됩니다.`);
    res.cookies.delete("book_oauth_state");
    return res;
  } catch (e) {
    console.error("[book] oauth callback", e);
    return page("연결 실패", "토큰 교환 중 오류가 발생했습니다. 리디렉션 URI 설정을 확인해 주세요.", 502);
  }
}
