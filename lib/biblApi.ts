import { NextResponse } from "next/server";
import { z } from "zod";
import { describeLlmError } from "./openai";
import type { VideoResult } from "./youtube";

/** 브라우저가 보낸 영상 스냅샷을 검증한다. 이미지 주소는 YouTube 이미지 서버만 허용한다. */
const IMG = /^https:\/\/(i\d?\.ytimg\.com|yt\d\.ggpht\.com|yt\d\.googleusercontent\.com)\//;
const grade = z.enum(["Great", "Good", "Normal", "Bad", "Worst"]).nullable();
const num = z.number().finite();

export const VideoSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  title: z.string().max(300),
  thumbnail: z.string().max(300).refine((s) => s === "" || IMG.test(s)),
  publishedAt: z.string().max(40),
  durationSec: num,
  views: num,
  likes: num.nullable(),
  comments: num.nullable(),
  hasCaption: z.boolean(),
  channelId: z.string().max(64),
  channelTitle: z.string().max(200),
  channelThumbnail: z.string().max(300).refine((s) => s === "" || IMG.test(s)),
  subscribers: num.nullable(),
  channelVideoCount: num,
  channelViewCount: num,
  performanceRatio: num.nullable(),
  contributionRatio: num.nullable(),
  exposureRatio: num.nullable(),
  dailyViews: num,
  performance: grade,
  contribution: grade,
  exposure: grade,
});

export function parseVideo(x: unknown): VideoResult | null {
  const r = VideoSchema.safeParse(x);
  return r.success ? (r.data as VideoResult) : null;
}

export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export function aiError(e: unknown) {
  return NextResponse.json({ error: describeLlmError(e) }, { status: 502 });
}
