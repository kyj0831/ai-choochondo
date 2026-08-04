import { NextRequest, NextResponse } from "next/server";
import { buildRobotsTxt } from "@/lib/crawlers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return new NextResponse(buildRobotsTxt(`${proto}://${host}`), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
