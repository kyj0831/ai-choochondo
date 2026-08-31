import { NextResponse } from "next/server";
import { getProvider } from "@/lib/openai";
import { ALL_ENGINES, configuredEngines } from "@/lib/engines";

export async function GET() {
  return NextResponse.json({
    provider: getProvider(),
    // 화면에서 "자동 수집" 버튼을 누르기 전에 어떤 엔진이 실제로 불릴지 보여주기 위함.
    engines: ALL_ENGINES,
    configuredEngines: configuredEngines(),
  });
}
