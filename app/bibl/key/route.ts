import { NextRequest, NextResponse } from "next/server";
import { isValidKey, setKeyCookie } from "@/lib/biblOwner";

/** 열쇠 링크를 열면 그 보관함을 이 기기에 연결하고 보관함으로 보낸다. */
export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("k");
  const res = NextResponse.redirect(new URL("/bibl/library", req.url));
  if (isValidKey(k)) setKeyCookie(res, k);
  return res;
}
