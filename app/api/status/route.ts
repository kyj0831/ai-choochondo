import { NextResponse } from "next/server";
import { getProvider } from "@/lib/openai";

export async function GET() {
  return NextResponse.json({ provider: getProvider() });
}
