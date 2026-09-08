import { NextResponse } from "next/server";
import { getProvider } from "@/lib/openai";
import { storageInfo } from "@/lib/db";
import { isAdmin } from "@/lib/owner";

// 저장 상태는 매 요청 시점의 사실이어야 한다. 캐시된 값으로 "데이터 있음"을 보여주면
// 정작 날아간 상황을 못 잡는다.
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await isAdmin();
  const storage = storageInfo();
  return NextResponse.json({
    provider: getProvider(),
    // 서버 절대 경로는 운영자에게만. 사장님 화면에는 필요 없고, 공개하면 서버 구조가 새어 나간다.
    storage: admin ? storage : { ...storage, dbPath: null, dataDir: null },
    isAdmin: admin,
    // 운영자 비밀번호가 없으면 "운영자" 가 존재하지 않는다. 배포 환경이면 경고 대상.
    adminConfigured: !!process.env.APP_PASSWORD,
  });
}
