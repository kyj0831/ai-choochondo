import { NextResponse } from "next/server";
import { readKey } from "@/lib/biblOwner";

export const dynamic = "force-dynamic";

/** 이 브라우저의 보관함 열쇠 링크. 다른 기기(휴대폰)에서 같은 보관함을 열 때 쓴다. */
export async function GET() {
  const k = readKey();
  return NextResponse.json({ path: k ? `/bibl/key?k=${k}` : null });
}
