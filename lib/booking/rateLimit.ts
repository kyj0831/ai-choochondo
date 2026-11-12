import { NextRequest } from "next/server";

/**
 * 공개 예약 API용 간단한 IP별 횟수 제한(서버 메모리).
 * 누구나 여는 페이지라, 반복 호출로 캘린더에 스팸 초대가 쌓이거나
 * AI 호출 비용이 새는 것을 막는다. 서버 한 대 기준이며 재시작하면 초기화된다.
 */
const buckets = new Map<string, number[]>();

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    req.ip ||
    "unknown"
  );
}

/** 허용이면 true. windowMs 동안 limit 회까지. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  }
  return true;
}
