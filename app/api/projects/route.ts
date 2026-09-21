import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects, setProjectOwnerHash } from "@/lib/repo";
import { canAccessProject, claimPath, grantOwnerCookie, hashToken, isAdmin, newOwnerToken } from "@/lib/owner";

export const dynamic = "force-dynamic";

/** 운영자는 전체, 그 밖에는 이 브라우저가 소유 키를 가진 진단만. */
export async function GET() {
  const admin = await isAdmin();
  const all = listProjects();
  const projects = admin ? all : (await Promise.all(all.map(async (p) => ((await canAccessProject(p)) ? p : null)))).filter(Boolean);
  return NextResponse.json({ projects, isAdmin: admin });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { brand_name, entity_type, region, language, categories, audiences } = body;
  if (!brand_name || !entity_type || !region) {
    return NextResponse.json({ error: "brand_name, entity_type, region은 필수입니다." }, { status: 400 });
  }
  const project = createProject({
    brand_name,
    entity_type,
    region,
    language: language || "한국어",
    categories: categories || [],
    audiences: audiences || [],
  });

  // 소유 키 발급. 해시만 저장하고 원문은 쿠키와 복구 링크에만 둔다.
  const token = newOwnerToken();
  setProjectOwnerHash(project.id, hashToken(token));

  const res = NextResponse.json({ project: { ...project, owner_token_hash: hashToken(token) }, ownerLink: claimPath(project.id, token) });
  grantOwnerCookie(res, token);
  return res;
}
