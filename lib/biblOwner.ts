import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

/**
 * BIBL 보관함 열쇠 — 회원가입 없이 "내 보관함"을 구분한다.
 *
 * 처음 저장할 때 브라우저에 무작위 열쇠를 쿠키로 심고, DB에는 해시만 둔다.
 * 휴대폰 등 다른 기기에서 열려면 보관함 화면의 "열쇠 링크"(/bibl/key?k=…)를 열면 된다.
 */
export const BIBL_COOKIE = "bibl_owner";

export function hashKey(k: string): string {
  return createHash("sha256").update(`bibl:${k}`).digest("hex");
}

export function isValidKey(k: string | null | undefined): k is string {
  return !!k && /^[a-f0-9]{48}$/.test(k);
}

/** 현재 열쇠. 없으면 null. */
export function readKey(): string | null {
  const v = cookies().get(BIBL_COOKIE)?.value;
  return isValidKey(v) ? v : null;
}

/** 열쇠가 없으면 새로 만든다. issued=true면 응답에 setKeyCookie를 해야 한다. */
export function resolveOwner(): { key: string; hash: string; issued: boolean } {
  const existing = readKey();
  if (existing) return { key: existing, hash: hashKey(existing), issued: false };
  const key = randomBytes(24).toString("hex");
  return { key, hash: hashKey(key), issued: true };
}

/** 읽기 전용 요청용. 열쇠가 없으면 보관함이 비어 있는 것과 같다. */
export function ownerHashOrNull(): string | null {
  const k = readKey();
  return k ? hashKey(k) : null;
}

export function setKeyCookie(res: NextResponse, key: string) {
  res.cookies.set(BIBL_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365 * 2,
  });
}
