import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { AUTH_COOKIE, authToken } from "./auth";
import { getProject } from "./repo";
import { Project } from "./types";

/**
 * 소유권 모델 — 회원가입 없이 "내 진단만" 보이게 한다.
 *
 * 문제: 비밀번호 하나를 다 같이 쓰는 구조라, 배포하면 사장님 A의 첫 화면에
 * 사장님 B의 점수가 뜬다. 제안서의 "회원가입 없이 상호만 입력"을 지키면서
 * 이걸 막아야 한다.
 *
 * 방식: 진단을 만들 때 비밀 키를 하나 발급한다. 키의 해시만 DB에 두고,
 * 원문은 그 브라우저의 쿠키와 복구 링크(/claim/{id}?key=…)에만 있다.
 * 구글 문서의 "링크 있는 사람만" 과 같은 모델이다.
 *
 * 역할은 둘뿐이다.
 *  - 소유자: 쿠키에 그 진단의 키가 있는 사람. 자기 진단만 본다.
 *  - 운영자: APP_PASSWORD 로 로그인한 사람. 전체를 본다. (사장님 본인, 나중엔 지자체)
 *
 * 규칙 하나: 권한이 없으면 "없는 진단"과 똑같이 보인다(404). 존재 여부를 흘리지 않는다.
 */

export const OWNER_COOKIE = "ai_choochondo_owner";
const MAX_TOKENS = 50;

export function newOwnerToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 이 브라우저가 들고 있는 소유 키 원문 목록. */
export function readOwnerTokens(): string[] {
  const raw = cookies().get(OWNER_COOKIE)?.value;
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((t) => typeof t === "string" && /^[a-f0-9]{64}$/.test(t)) : [];
  } catch {
    return [];
  }
}

/** APP_PASSWORD 로 로그인한 운영자인가. 비밀번호가 설정돼 있지 않으면 운영자는 존재하지 않는다. */
export async function isAdmin(): Promise<boolean> {
  const password = process.env.APP_PASSWORD;
  if (!password) return false;
  const got = cookies().get(AUTH_COOKIE)?.value;
  if (!got) return false;
  return got === (await authToken(password));
}

/**
 * 접근 가능 여부.
 * - 운영자는 전부.
 * - 소유 키가 있는 진단은 키를 가진 브라우저만.
 * - 키가 없는 옛 진단(이 기능 전에 만든 것)은 운영자 소유로 본다. 다만 운영자가
 *   아예 없는 환경(로컬, 비밀번호 미설정)에서는 예전처럼 보이게 둔다 — 안 그러면
 *   업데이트 직후 자기 진단이 사라진 것처럼 보인다.
 */
export async function canAccessProject(project: Project): Promise<boolean> {
  if (await isAdmin()) return true;
  if (!project.owner_token_hash) return !process.env.APP_PASSWORD;
  const mine = new Set(readOwnerTokens().map(hashToken));
  return mine.has(project.owner_token_hash);
}

/** getProject 의 권한 검사 버전. 권한이 없으면 없는 것과 똑같이 undefined. */
export async function requireProject(id: string): Promise<Project | undefined> {
  const project = getProject(id);
  if (!project) return undefined;
  return (await canAccessProject(project)) ? project : undefined;
}

/** 이 브라우저가 가진 키 중 해당 진단의 것. 복구 링크를 만들 때 쓴다. 없으면 null. */
export function ownerTokenFor(project: Project): string | null {
  if (!project.owner_token_hash) return null;
  return readOwnerTokens().find((t) => hashToken(t) === project.owner_token_hash) ?? null;
}

export function claimPath(projectId: string, token: string): string {
  return `/claim/${projectId}?key=${token}`;
}

/** 응답에 소유 키를 쿠키로 얹는다. 기존 키는 유지하고 뒤에 붙인다. */
export function grantOwnerCookie(res: NextResponse, token: string) {
  const next = Array.from(new Set([...readOwnerTokens(), token])).slice(-MAX_TOKENS);
  res.cookies.set(OWNER_COOKIE, JSON.stringify(next), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
