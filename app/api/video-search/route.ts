import { NextRequest, NextResponse } from "next/server";
import { hasYoutubeKey, searchVideos, SearchParams } from "@/lib/youtube";

export const dynamic = "force-dynamic";

const PERIODS = ["all", "1d", "7d", "30d", "90d", "365d"] as const;
const DURATIONS = ["any", "short", "medium", "long", "shorts"] as const;
const ORDERS = ["relevance", "viewCount", "date"] as const;

function pick<T extends readonly string[]>(v: string | null, allowed: T, fallback: T[number]): T[number] {
  return v && (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode") === "hot" ? "hot" : "search";
  const q = (sp.get("q") ?? "").trim().slice(0, 100);

  if (mode === "search" && !q) {
    return NextResponse.json({ error: "검색어를 입력하세요." }, { status: 400 });
  }

  const params: SearchParams = {
    mode,
    q,
    period: pick(sp.get("period"), PERIODS, "all"),
    duration: pick(sp.get("duration"), DURATIONS, "any"),
    order: pick(sp.get("order"), ORDERS, "relevance"),
    region: /^[A-Z]{2}$/.test(sp.get("region") ?? "") ? sp.get("region")! : "KR",
    pages: Math.min(4, Math.max(1, Number(sp.get("pages")) || 1)),
  };

  try {
    const videos = await searchVideos(params);
    return NextResponse.json({ demo: !hasYoutubeKey(), params, videos });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "검색에 실패했습니다." },
      { status: 502 }
    );
  }
}
