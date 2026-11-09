/**
 * 영상 찾기 — 유튜브 영상 검색과 성과 지표 계산.
 *
 * YouTube Data API v3를 쓴다. YOUTUBE_API_KEY가 없으면 데모(샘플) 데이터로 동작한다.
 *
 * 지표 정의 (뷰트랩 화면을 참고해 이 서비스가 정한 기준. 뷰트랩의 실제 수식은 공개돼 있지 않다):
 * - 성과도: 영상 조회수 ÷ 채널 구독자 수. 구독자 규모에 비해 얼마나 많이 퍼졌나.
 * - 기여도: 영상 조회수 ÷ 채널 영상 1개당 평균 조회수. 그 채널 안에서 얼마나 튀었나.
 * - 노출확률(추정): 최근 하루 평균 조회수가 채널 평소 속도보다 빠른가. 지금도 추천 알고리즘을
 *   타고 있을 가능성을 어림한다. 시간대별 조회수 이력이 없으므로 "추정"이다.
 */

export type Grade = "Great" | "Good" | "Normal" | "Bad" | "Worst";

export interface VideoResult {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  durationSec: number;
  views: number;
  likes: number | null;
  comments: number | null;
  hasCaption: boolean;
  channelId: string;
  channelTitle: string;
  channelThumbnail: string;
  subscribers: number | null; // 구독자 수 비공개 채널은 null
  channelVideoCount: number;
  channelViewCount: number;
  // 계산 지표
  performanceRatio: number | null; // 성과도 원값 (조회수/구독자)
  contributionRatio: number | null; // 기여도 원값 (조회수/채널 평균)
  exposureRatio: number | null; // 노출확률 원값 (최근 속도/평소 속도)
  dailyViews: number;
  performance: Grade | null;
  contribution: Grade | null;
  exposure: Grade | null;
}

export interface SearchParams {
  q?: string;
  mode: "search" | "hot";
  period: "all" | "1d" | "7d" | "30d" | "90d" | "365d";
  duration: "any" | "short" | "medium" | "long" | "shorts";
  order: "relevance" | "viewCount" | "date";
  region: string; // KR, US, JP ...
  pages: number; // 50개 단위 페이지 수 (1~4)
}

export const GRADE_ORDER: Grade[] = ["Worst", "Bad", "Normal", "Good", "Great"];

function grade(value: number | null, cuts: [number, number, number, number]): Grade | null {
  if (value == null || !isFinite(value)) return null;
  const [bad, normal, good, great] = cuts;
  if (value >= great) return "Great";
  if (value >= good) return "Good";
  if (value >= normal) return "Normal";
  if (value >= bad) return "Bad";
  return "Worst";
}

/** 등급 경계값. 화면 도움말에도 그대로 노출한다. */
export const CUTS = {
  performance: [0.1, 0.5, 2, 10] as [number, number, number, number],
  contribution: [0.3, 0.7, 2, 5] as [number, number, number, number],
  exposure: [0.3, 0.7, 1.5, 4] as [number, number, number, number],
};

export function computeMetrics(
  v: Omit<
    VideoResult,
    | "performanceRatio"
    | "contributionRatio"
    | "exposureRatio"
    | "dailyViews"
    | "performance"
    | "contribution"
    | "exposure"
  >,
  now = Date.now()
): VideoResult {
  const ageDays = Math.max(1, (now - new Date(v.publishedAt).getTime()) / 86_400_000);
  const dailyViews = v.views / ageDays;

  const performanceRatio = v.subscribers && v.subscribers > 0 ? v.views / v.subscribers : null;

  const channelAvg = v.channelVideoCount > 0 ? v.channelViewCount / v.channelVideoCount : 0;
  const contributionRatio = channelAvg > 0 ? v.views / channelAvg : null;

  // 채널 평균 영상은 공개 후 약 30일 동안 조회수 대부분을 모은다고 보고, 그 속도를 "평소 속도"로 둔다.
  // 오래된 영상은 누적 평균이 자연히 떨어지므로 90일이 지나면 한 단계씩 감쇠한다.
  let exposureRatio: number | null = null;
  if (channelAvg > 0) {
    const usualDaily = channelAvg / 30;
    const decay = ageDays > 90 ? Math.sqrt(90 / ageDays) : 1;
    exposureRatio = (dailyViews / usualDaily) * decay;
  }

  return {
    ...v,
    dailyViews,
    performanceRatio,
    contributionRatio,
    exposureRatio,
    performance: grade(performanceRatio, CUTS.performance),
    contribution: grade(contributionRatio, CUTS.contribution),
    exposure: grade(exposureRatio, CUTS.exposure),
  };
}

// ── ISO 8601 길이 → 초 ────────────────────────────────────────────────
export function parseDuration(iso: string): number {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || "");
  if (!m) return 0;
  const [, d, h, mi, s] = m;
  return (+(d || 0)) * 86400 + (+(h || 0)) * 3600 + (+(mi || 0)) * 60 + +(s || 0);
}

export function hasYoutubeKey(): boolean {
  return !!process.env.YOUTUBE_API_KEY?.trim();
}

// ── 실제 API 호출 ─────────────────────────────────────────────────────
const API = "https://www.googleapis.com/youtube/v3";

async function yt(path: string, params: Record<string, string | number | undefined>) {
  const key = process.env.YOUTUBE_API_KEY!.trim();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  qs.set("key", key);
  const res = await fetch(`${API}/${path}?${qs}`, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason;
    if (reason === "quotaExceeded") throw new Error("오늘 YouTube API 사용량(쿼터)을 다 썼습니다. 내일 다시 시도하세요.");
    if (reason === "keyInvalid" || res.status === 400 && /API key/i.test(body?.error?.message ?? ""))
      throw new Error("YOUTUBE_API_KEY가 올바르지 않습니다.");
    throw new Error(`YouTube API 오류 (HTTP ${res.status}): ${body?.error?.message ?? "알 수 없음"}`);
  }
  return body;
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const PERIOD_DAYS: Record<SearchParams["period"], number | null> = {
  all: null,
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "365d": 365,
};

async function fetchVideoIds(p: SearchParams): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  const days = PERIOD_DAYS[p.period];
  const publishedAfter = days ? new Date(Date.now() - days * 86_400_000).toISOString() : undefined;
  // API의 videoDuration: short(<4분) medium(4~20분) long(>20분). 쇼츠는 short로 받고 아래에서 3분 이하만 남긴다.
  const videoDuration = p.duration === "any" ? undefined : p.duration === "shorts" ? "short" : p.duration;

  for (let i = 0; i < p.pages; i++) {
    const body =
      p.mode === "hot"
        ? await yt("videos", {
            part: "id",
            chart: "mostPopular",
            regionCode: p.region,
            maxResults: 50,
            pageToken,
          })
        : await yt("search", {
            part: "id",
            type: "video",
            q: p.q,
            maxResults: 50,
            order: p.order,
            regionCode: p.region,
            relevanceLanguage: REGION_LANG[p.region],
            publishedAfter,
            videoDuration,
            pageToken,
          });
    for (const it of body.items ?? []) ids.push(typeof it.id === "string" ? it.id : it.id?.videoId);
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return Array.from(new Set(ids.filter(Boolean)));
}

const REGION_LANG: Record<string, string> = { KR: "ko", US: "en", JP: "ja", GB: "en", TW: "zh-Hant", VN: "vi" };

// 같은 조건의 검색은 6시간 동안 다시 부르지 않는다. 키워드 검색 1회가 쿼터 100단위라 아껴야 한다.
const CACHE_MS = 6 * 60 * 60 * 1000;
declare global {
  // eslint-disable-next-line no-var
  var __ytCache: Map<string, { at: number; data: VideoResult[] }> | undefined;
}
const cache = (global.__ytCache ??= new Map());

export async function searchVideos(p: SearchParams): Promise<VideoResult[]> {
  if (!hasYoutubeKey()) return mockVideos(p);
  const key = JSON.stringify(p);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;
  const data = await searchVideosUncached(p);
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 300) cache.delete(cache.keys().next().value!);
  return data;
}

async function searchVideosUncached(p: SearchParams): Promise<VideoResult[]> {

  const ids = await fetchVideoIds(p);
  if (ids.length === 0) return [];

  const videos: any[] = [];
  for (const group of chunk(ids, 50)) {
    const body = await yt("videos", {
      part: "snippet,statistics,contentDetails",
      id: group.join(","),
      maxResults: 50,
    });
    videos.push(...(body.items ?? []));
  }

  const channelIds = Array.from(new Set(videos.map((v) => v.snippet?.channelId).filter(Boolean)));
  const channels = new Map<string, any>();
  for (const group of chunk(channelIds, 50)) {
    const body = await yt("channels", { part: "snippet,statistics", id: group.join(","), maxResults: 50 });
    for (const c of body.items ?? []) channels.set(c.id, c);
  }

  const now = Date.now();
  let results = videos.map((v) => {
    const c = channels.get(v.snippet.channelId);
    const st = c?.statistics ?? {};
    return computeMetrics(
      {
        id: v.id,
        title: v.snippet.title,
        thumbnail:
          v.snippet.thumbnails?.medium?.url ?? v.snippet.thumbnails?.high?.url ?? v.snippet.thumbnails?.default?.url ?? "",
        publishedAt: v.snippet.publishedAt,
        durationSec: parseDuration(v.contentDetails?.duration),
        views: Number(v.statistics?.viewCount ?? 0),
        likes: v.statistics?.likeCount != null ? Number(v.statistics.likeCount) : null,
        comments: v.statistics?.commentCount != null ? Number(v.statistics.commentCount) : null,
        hasCaption: v.contentDetails?.caption === "true",
        channelId: v.snippet.channelId,
        channelTitle: v.snippet.channelTitle,
        channelThumbnail: c?.snippet?.thumbnails?.default?.url ?? "",
        subscribers: st.hiddenSubscriberCount ? null : Number(st.subscriberCount ?? 0) || null,
        channelVideoCount: Number(st.videoCount ?? 0),
        channelViewCount: Number(st.viewCount ?? 0),
      },
      now
    );
  });

  // 핫 비디오(인기 차트)는 API가 길이 필터를 받지 않으므로 여기서 거른다.
  results = results.filter((r) => durationMatches(r.durationSec, p.duration));
  return results;
}

function durationMatches(sec: number, d: SearchParams["duration"]): boolean {
  switch (d) {
    case "shorts":
      return sec > 0 && sec <= 180;
    case "short":
      return sec < 240;
    case "medium":
      return sec >= 240 && sec <= 1200;
    case "long":
      return sec > 1200;
    default:
      return true;
  }
}

// ── 데모 데이터 ───────────────────────────────────────────────────────
function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const DEMO_TOPICS = [
  "단독 인터뷰", "현장 영상", "팩트체크", "3분 정리", "속보 브리핑", "전문가 분석",
  "뒷이야기", "현장 르포", "데이터로 본", "쇼츠 요약", "풀영상", "핵심만",
];
const DEMO_CHANNELS = [
  "노컷브리핑", "시사한입", "데이터저널", "현장기록", "뉴스줍줍", "오늘의이슈",
  "경제한스푼", "정치읽기", "사회부24시", "세계는지금", "스포츠라운지", "문화살롱",
];

function mockVideos(p: SearchParams): VideoResult[] {
  const keyword = p.mode === "hot" ? "오늘의 이슈" : p.q?.trim() || "뉴스";
  let h = 0;
  for (const ch of keyword + p.period + p.duration) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const rnd = seeded(h);
  const now = Date.now();
  const days = PERIOD_DAYS[p.period] ?? 1500;
  const n = 24 * Math.max(1, Math.min(p.pages, 4));

  const list: VideoResult[] = [];
  for (let i = 0; i < n; i++) {
    const subs = Math.round(10 ** (2.5 + rnd() * 4)); // 300 ~ 300만
    const videoCount = Math.round(10 + rnd() * 1500);
    const avg = subs * (0.05 + rnd() * 0.6);
    const views = Math.round(avg * 10 ** (rnd() * 2.6 - 1));
    const durationSec =
      p.duration === "shorts" ? Math.round(15 + rnd() * 160)
      : p.duration === "long" ? Math.round(1300 + rnd() * 3000)
      : p.duration === "medium" ? Math.round(250 + rnd() * 900)
      : p.duration === "short" ? Math.round(20 + rnd() * 210)
      : Math.round(15 + rnd() * 3000);
    const ch = Math.floor(rnd() * DEMO_CHANNELS.length);
    list.push(
      computeMetrics(
        {
          id: `demo-${h}-${i}`,
          title: `[${DEMO_TOPICS[Math.floor(rnd() * DEMO_TOPICS.length)]}] ${keyword} — 샘플 영상 ${i + 1}`,
          thumbnail: "",
          publishedAt: new Date(now - rnd() * days * 86_400_000).toISOString(),
          durationSec,
          views,
          likes: Math.round(views * (0.005 + rnd() * 0.04)),
          comments: Math.round(views * (0.0005 + rnd() * 0.004)),
          hasCaption: rnd() > 0.6,
          channelId: `demo-ch-${ch}`,
          channelTitle: DEMO_CHANNELS[ch],
          channelThumbnail: "",
          subscribers: rnd() > 0.05 ? subs : null,
          channelVideoCount: videoCount,
          channelViewCount: Math.round(avg * videoCount),
        },
        now
      )
    );
  }
  return list;
}
