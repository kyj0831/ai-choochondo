import { NextRequest, NextResponse } from "next/server";
import { getProject } from "@/lib/repo";
import { grantOwnerCookie, hashToken } from "@/lib/owner";

export const dynamic = "force-dynamic";

/**
 * 복구 링크. /claim/{id}?key=… 를 열면 이 브라우저에 소유 키를 심고 리포트로 보낸다.
 *
 * 사장님이 다른 기기에서 열거나, 쿠키를 지웠거나, 카톡에 저장해둔 링크로 돌아올 때 쓴다.
 * 키가 틀리면 쿠키를 심지 않고 그냥 리포트로 보낸다 — 거기서 권한 없음 안내가 뜬다.
 * 여기서 "키가 틀렸다"고 따로 말하지 않는 이유: 그 진단이 존재한다는 사실 자체를
 * 흘리지 않기 위해서다.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const dest = new URL(`/projects/${params.id}/report`, req.nextUrl.origin);
  const res = NextResponse.redirect(dest);

  const project = getProject(params.id);
  if (project?.owner_token_hash && /^[a-f0-9]{64}$/.test(key) && hashToken(key) === project.owner_token_hash) {
    grantOwnerCookie(res, key);
  }
  return res;
}
