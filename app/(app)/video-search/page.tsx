"use client";

import { useEffect, useMemo, useState } from "react";
import type { Grade, VideoResult } from "@/lib/youtube";

// ── 표시용 도우미 ─────────────────────────────────────────────────────
function fmtCount(n: number | null | undefined): string {
  if (n == null) return "비공개";
  if (n >= 100_000_000) return `${+(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${+(n / 10_000).toFixed(1)}만`;
  return n.toLocaleString("ko-KR");
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function fmtRatio(r: number | null): string {
  if (r == null) return "-";
  return r >= 10 ? `${Math.round(r)}배` : `${r.toFixed(1)}배`;
}

const GRADE_STYLE: Record<Grade, { dots: number; color: string }> = {
  Great: { dots: 5, color: "text-emerald-600" },
  Good: { dots: 4, color: "text-lime-600" },
  Normal: { dots: 3, color: "text-slate-400" },
  Bad: { dots: 2, color: "text-orange-500" },
  Worst: { dots: 1, color: "text-red-600" },
};
const GRADE_RANK: Record<Grade, number> = { Worst: 1, Bad: 2, Normal: 3, Good: 4, Great: 5 };

function GradeBadge({ grade, ratio }: { grade: Grade | null; ratio: number | null }) {
  if (!grade) return <span className="text-slate-300">-</span>;
  const g = GRADE_STYLE[grade];
  return (
    <span className={`inline-flex flex-col items-center leading-none ${g.color}`} title={fmtRatio(ratio)}>
      <span className="text-[10px] tracking-[1px]">{"•".repeat(g.dots)}</span>
      <span className="text-sm font-bold">{grade}</span>
    </span>
  );
}

// ── 정렬 ──────────────────────────────────────────────────────────────
type SortKey =
  | "views" | "subscribers" | "contribution" | "performance" | "exposure"
  | "duration" | "channelVideos" | "published";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "views", label: "조회수" },
  { key: "subscribers", label: "구독자" },
  { key: "contribution", label: "기여도" },
  { key: "performance", label: "성과도" },
  { key: "exposure", label: "노출확률" },
  { key: "duration", label: "영상 길이" },
  { key: "channelVideos", label: "총 영상 수" },
  { key: "published", label: "게시일" },
];

function sortValue(v: VideoResult, k: SortKey): number {
  switch (k) {
    case "views": return v.views;
    case "subscribers": return v.subscribers ?? -1;
    case "contribution": return v.contributionRatio ?? -1;
    case "performance": return v.performanceRatio ?? -1;
    case "exposure": return v.exposureRatio ?? -1;
    case "duration": return v.durationSec;
    case "channelVideos": return v.channelVideoCount;
    case "published": return new Date(v.publishedAt).getTime();
  }
}

// ── 검색 조건 ─────────────────────────────────────────────────────────
interface Query {
  mode: "search" | "hot";
  q: string;
  period: string;
  duration: string;
  order: string;
  region: string;
  pages: number;
}

const DEFAULT_QUERY: Query = {
  mode: "search", q: "", period: "all", duration: "any", order: "relevance", region: "KR", pages: 1,
};

const HISTORY_KEY = "video-search-history";

function loadHistory(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function saveHistory(list: string[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 20)));
  } catch {}
}

export default function VideoSearchPage() {
  const [query, setQuery] = useState<Query>(DEFAULT_QUERY);
  const [showFilters, setShowFilters] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const [videos, setVideos] = useState<VideoResult[] | null>(null);
  const [resultLabel, setResultLabel] = useState("");
  const [demo, setDemo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sort, setSort] = useState<{ key: SortKey; desc: boolean } | null>(null);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenVideos, setHiddenVideos] = useState<Set<string>>(new Set());
  const [hiddenChannels, setHiddenChannels] = useState<Set<string>>(new Set());

  // 결과 안에서 다시 거르는 조건 (API를 다시 부르지 않음)
  const [minViews, setMinViews] = useState(0);
  const [subsMin, setSubsMin] = useState(0);
  const [subsMax, setSubsMax] = useState(0);
  const [minPerf, setMinPerf] = useState<Grade | "">("");
  const [minContrib, setMinContrib] = useState<Grade | "">("");

  useEffect(() => setHistory(loadHistory()), []);

  async function run(next: Query) {
    if (next.mode === "search" && !next.q.trim()) {
      setError("검색어를 입력하세요.");
      return;
    }
    setQuery(next);
    setLoading(true);
    setError(null);
    setShowHistory(false);
    try {
      const qs = new URLSearchParams({
        mode: next.mode, q: next.q.trim(), period: next.period, duration: next.duration,
        order: next.order, region: next.region, pages: String(next.pages),
      });
      const res = await fetch(`/api/video-search?${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setVideos(body.videos);
      setDemo(!!body.demo);
      setSelected(new Set());
      setHiddenVideos(new Set());
      setHiddenChannels(new Set());
      const today = fmtDate(new Date().toISOString()).replace(/\./g, "-");
      setResultLabel(next.mode === "hot" ? `${today} 핫 비디오` : `"${next.q.trim()}" 검색 결과`);
      if (next.mode === "search") {
        const h = [next.q.trim(), ...loadHistory().filter((x) => x !== next.q.trim())];
        saveHistory(h);
        setHistory(h.slice(0, 20));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  const shown = useMemo(() => {
    if (!videos) return [];
    let list = videos.filter(
      (v) =>
        !hiddenVideos.has(v.id) &&
        !hiddenChannels.has(v.channelId) &&
        v.views >= minViews &&
        (subsMin <= 0 || (v.subscribers ?? 0) >= subsMin) &&
        (subsMax <= 0 || (v.subscribers ?? Infinity) <= subsMax) &&
        (!minPerf || (v.performance && GRADE_RANK[v.performance] >= GRADE_RANK[minPerf])) &&
        (!minContrib || (v.contribution && GRADE_RANK[v.contribution] >= GRADE_RANK[minContrib]))
    );
    if (sort) {
      list = [...list].sort((a, b) => {
        const d = sortValue(a, sort.key) - sortValue(b, sort.key);
        return sort.desc ? -d : d;
      });
    }
    return list;
  }, [videos, hiddenVideos, hiddenChannels, minViews, subsMin, subsMax, minPerf, minContrib, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s?.key === key ? (s.desc ? { key, desc: false } : null) : { key, desc: true }));
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function removeSelectedVideos() {
    setHiddenVideos((h) => new Set([...h, ...selected]));
    setSelected(new Set());
  }

  function removeSelectedChannels() {
    const chs = new Set(shown.filter((v) => selected.has(v.id)).map((v) => v.channelId));
    setHiddenChannels((h) => new Set([...h, ...chs]));
    setSelected(new Set());
  }

  function downloadCsv() {
    const rows = selected.size > 0 ? shown.filter((v) => selected.has(v.id)) : shown;
    const header = [
      "제목", "URL", "채널", "채널 URL", "구독자", "조회수", "좋아요", "댓글", "게시일", "길이(초)",
      "자막", "성과도", "성과도(배)", "기여도", "기여도(배)", "노출확률(추정)", "일평균 조회수", "채널 총 영상 수",
    ];
    const esc = (x: unknown) => `"${String(x ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((v) =>
      [
        v.title, `https://www.youtube.com/watch?v=${v.id}`, v.channelTitle,
        `https://www.youtube.com/channel/${v.channelId}`, v.subscribers ?? "", v.views, v.likes ?? "",
        v.comments ?? "", fmtDate(v.publishedAt), v.durationSec, v.hasCaption ? "Y" : "",
        v.performance ?? "", v.performanceRatio?.toFixed(2) ?? "", v.contribution ?? "",
        v.contributionRatio?.toFixed(2) ?? "", v.exposure ?? "", Math.round(v.dailyViews), v.channelVideoCount,
      ].map(esc).join(",")
    );
    const blob = new Blob(["﻿" + [header.map(esc).join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `영상찾기_${(query.mode === "hot" ? "핫비디오" : query.q).slice(0, 30)}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const activeFilters = minViews > 0 || subsMin > 0 || subsMax > 0 || !!minPerf || !!minContrib;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">영상 찾기</h1>
          <p className="mt-1 text-sm text-slate-500">
            구독자 수에 비해, 그 채널 평소보다 잘 터진 유튜브 영상을 찾아 기획에 씁니다.
          </p>
        </div>
        <button className="btn-ghost" onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? "지표 설명 닫기" : "지표는 어떻게 계산하나요?"}
        </button>
      </div>

      {showHelp && <MetricHelp />}

      {/* ── 검색 줄 ── */}
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex min-w-[260px] flex-1 overflow-hidden rounded-xl border border-emerald-500 bg-white"
          onSubmit={(e) => {
            e.preventDefault();
            run({ ...query, mode: "search" });
          }}
        >
          <input
            className="flex-1 px-4 py-2.5 text-sm outline-none"
            placeholder="단어 또는 문장 입력"
            value={query.q}
            onChange={(e) => setQuery({ ...query, q: e.target.value })}
          />
          <select
            className="border-l border-slate-200 bg-white px-2 text-sm"
            value={query.region}
            onChange={(e) => setQuery({ ...query, region: e.target.value })}
            aria-label="국가"
          >
            <option value="KR">🇰🇷</option>
            <option value="US">🇺🇸</option>
            <option value="JP">🇯🇵</option>
            <option value="GB">🇬🇧</option>
            <option value="TW">🇹🇼</option>
            <option value="VN">🇻🇳</option>
          </select>
          <button type="submit" className="bg-emerald-600 px-4 text-white hover:bg-emerald-700" aria-label="검색">
            🔍
          </button>
        </form>

        <div className="relative">
          <button
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${showHistory ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            onClick={() => setShowHistory((v) => !v)}
          >
            검색 내역 {showHistory ? "▴" : "▾"}
          </button>
          {showHistory && (
            <div className="absolute z-20 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {history.length === 0 ? (
                <p className="p-2 text-sm text-slate-400">검색 내역이 없습니다.</p>
              ) : (
                <>
                  {history.map((h) => (
                    <button
                      key={h}
                      className="block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm hover:bg-slate-100"
                      onClick={() => run({ ...query, mode: "search", q: h })}
                    >
                      {h}
                    </button>
                  ))}
                  <button
                    className="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-100"
                    onClick={() => {
                      saveHistory([]);
                      setHistory([]);
                    }}
                  >
                    내역 지우기
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <button
          className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${showFilters ? "border-emerald-500 text-emerald-700" : "border-slate-200 bg-white text-slate-700"}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          ⚙ 필터{activeFilters ? " •" : ""}
        </button>

        <button
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${query.mode === "hot" && videos ? "bg-red-600 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
          onClick={() => run({ ...query, mode: "hot" })}
        >
          🔥 핫 비디오
        </button>

        <div className="ml-auto flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
          <button
            className={`rounded-lg px-3 py-1.5 text-sm ${view === "table" ? "bg-emerald-50 text-emerald-700" : "text-slate-400"}`}
            onClick={() => setView("table")}
            aria-label="표 보기"
          >
            ☰
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-sm ${view === "grid" ? "bg-emerald-50 text-emerald-700" : "text-slate-400"}`}
            onClick={() => setView("grid")}
            aria-label="카드 보기"
          >
            ▦
          </button>
        </div>
      </div>

      {/* ── 필터 ── */}
      {showFilters && (
        <div className="card mt-3 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="label">게시 기간</span>
            <select className="input" value={query.period} onChange={(e) => setQuery({ ...query, period: e.target.value })}>
              <option value="all">전체</option>
              <option value="1d">최근 1일</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
              <option value="90d">최근 90일</option>
              <option value="365d">최근 1년</option>
            </select>
          </div>
          <div>
            <span className="label">영상 길이</span>
            <select className="input" value={query.duration} onChange={(e) => setQuery({ ...query, duration: e.target.value })}>
              <option value="any">전체</option>
              <option value="shorts">쇼츠 (3분 이하)</option>
              <option value="short">4분 미만</option>
              <option value="medium">4~20분</option>
              <option value="long">20분 초과</option>
            </select>
          </div>
          <div>
            <span className="label">검색 순서</span>
            <select className="input" value={query.order} onChange={(e) => setQuery({ ...query, order: e.target.value })}>
              <option value="relevance">관련성</option>
              <option value="viewCount">조회수</option>
              <option value="date">최신</option>
            </select>
          </div>
          <div>
            <span className="label">가져올 영상 수</span>
            <select className="input" value={query.pages} onChange={(e) => setQuery({ ...query, pages: Number(e.target.value) })}>
              <option value={1}>최대 50개</option>
              <option value={2}>최대 100개</option>
              <option value={4}>최대 200개</option>
            </select>
          </div>
          <div>
            <span className="label">최소 조회수</span>
            <input className="input" type="number" min={0} value={minViews || ""} placeholder="0"
              onChange={(e) => setMinViews(Number(e.target.value) || 0)} />
          </div>
          <div>
            <span className="label">구독자 범위</span>
            <div className="flex items-center gap-1">
              <input className="input" type="number" min={0} value={subsMin || ""} placeholder="최소"
                onChange={(e) => setSubsMin(Number(e.target.value) || 0)} />
              <span className="text-slate-400">~</span>
              <input className="input" type="number" min={0} value={subsMax || ""} placeholder="최대"
                onChange={(e) => setSubsMax(Number(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <span className="label">성과도</span>
            <select className="input" value={minPerf} onChange={(e) => setMinPerf(e.target.value as Grade | "")}>
              <option value="">전체</option>
              <option value="Great">Great만</option>
              <option value="Good">Good 이상</option>
              <option value="Normal">Normal 이상</option>
            </select>
          </div>
          <div>
            <span className="label">기여도</span>
            <select className="input" value={minContrib} onChange={(e) => setMinContrib(e.target.value as Grade | "")}>
              <option value="">전체</option>
              <option value="Great">Great만</option>
              <option value="Good">Good 이상</option>
              <option value="Normal">Normal 이상</option>
            </select>
          </div>
          <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-4">
            위 줄(기간·길이·순서·개수)은 다음 검색부터 적용되고, 아래 줄(조회수·구독자·등급)은 지금 결과에 바로 적용됩니다.
          </p>
        </div>
      )}

      {demo && videos && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <b>데모 모드</b> — YouTube API 키가 없어 샘플 데이터를 보여 줍니다. 실제 검색을 하려면{" "}
          <code className="rounded bg-amber-100 px-1">.env.local</code>에{" "}
          <code className="rounded bg-amber-100 px-1">YOUTUBE_API_KEY=</code>를 넣고 서버를 다시 켜세요.
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── 결과 ── */}
      {loading && <p className="mt-10 text-center text-slate-400">영상을 불러오는 중…</p>}

      {!loading && !videos && !error && (
        <div className="card mt-6 p-10 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-700">키워드로 검색하거나 🔥 핫 비디오를 눌러 보세요</p>
          <p className="mt-2 text-sm">
            결과마다 <b>성과도</b>(구독자 대비 조회수), <b>기여도</b>(채널 평균 대비 조회수),{" "}
            <b>노출확률</b>(지금도 추천을 타고 있을 가능성)을 등급으로 보여 줍니다.
          </p>
        </div>
      )}

      {!loading && videos && (
        <>
          <div className="sticky top-0 z-10 mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 px-4 py-3">
            <span className="mr-auto font-medium text-slate-700">
              {resultLabel} ({shown.length})
            </span>
            {SORTS.map((s) => (
              <button
                key={s.key}
                className={`rounded-lg border bg-white px-3 py-1.5 text-sm ${sort?.key === s.key ? "border-emerald-500 text-emerald-700" : "border-slate-200 text-slate-600"}`}
                onClick={() => toggleSort(s.key)}
              >
                {s.label} {sort?.key === s.key ? (sort.desc ? "↓" : "↑") : "↕"}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-500">선택 {selected.size}개</span>
            <button className="btn-ghost" onClick={() => setSelected(new Set(shown.map((v) => v.id)))}>전체 선택</button>
            <button className="btn-ghost" onClick={() => setSelected(new Set())} disabled={!selected.size}>선택 해제</button>
            <button className="btn-ghost" onClick={removeSelectedVideos} disabled={!selected.size}>🗑 영상 제거</button>
            <button className="btn-ghost" onClick={removeSelectedChannels} disabled={!selected.size}>🗑 채널 제거</button>
            <button className="btn-ghost" onClick={downloadCsv} disabled={!shown.length}>
              ⬇ {selected.size ? "선택 영상" : "전체"} 엑셀(CSV) 저장
            </button>
            {(hiddenVideos.size > 0 || hiddenChannels.size > 0) && (
              <button
                className="btn-ghost"
                onClick={() => {
                  setHiddenVideos(new Set());
                  setHiddenChannels(new Set());
                }}
              >
                제거한 항목 되돌리기
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <p className="mt-10 text-center text-slate-400">조건에 맞는 영상이 없습니다.</p>
          ) : view === "grid" ? (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((v) => (
                <VideoCard key={v.id} v={v} selected={selected.has(v.id)} onSelect={() => toggleSelect(v.id)} />
              ))}
            </div>
          ) : (
            <VideoTable list={shown} selected={selected} onSelect={toggleSelect} />
          )}
        </>
      )}
    </div>
  );
}

// ── 썸네일 ────────────────────────────────────────────────────────────
function Thumb({ v, className }: { v: VideoResult; className: string }) {
  const href = v.id.startsWith("demo-") ? undefined : `https://www.youtube.com/watch?v=${v.id}`;
  const inner = v.thumbnail ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={v.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 px-3 text-center text-xs font-bold text-white/80">
      {v.title.slice(0, 30)}
    </div>
  );
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`relative block overflow-hidden rounded-lg bg-slate-200 ${className}`}>
      {inner}
      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-medium text-white">
        {fmtDuration(v.durationSec)}
      </span>
    </a>
  );
}

function ChannelAvatar({ v }: { v: VideoResult }) {
  return v.channelThumbnail ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={v.channelThumbnail} alt="" className="h-9 w-9 shrink-0 rounded-full" loading="lazy" />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
      {v.channelTitle.slice(0, 1)}
    </div>
  );
}

function VideoCard({ v, selected, onSelect }: { v: VideoResult; selected: boolean; onSelect: () => void }) {
  return (
    <div className={`card flex flex-col p-3 ${selected ? "ring-2 ring-emerald-500" : ""}`}>
      <Thumb v={v} className="aspect-video" />
      <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5" title={v.title}>
        {v.title}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        조회수 {fmtCount(v.views)} | 게시일 {fmtDate(v.publishedAt)}
      </p>
      <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
        <ChannelAvatar v={v} />
        <div className="min-w-0 flex-1 text-xs leading-4">
          <a
            href={v.channelId.startsWith("demo-") ? undefined : `https://www.youtube.com/channel/${v.channelId}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-medium text-slate-800 hover:underline"
          >
            {v.channelTitle}
          </a>
          <span className="block text-slate-500">구독자 {fmtCount(v.subscribers)}{v.subscribers != null ? "명" : ""}</span>
          <span className="block text-slate-500">총 영상 수 {fmtCount(v.channelVideoCount)}개</span>
        </div>
        <label className="flex cursor-pointer flex-col items-center rounded-lg border border-slate-200 px-2 py-1 text-[10px] text-slate-400">
          선택
          <input type="checkbox" className="mt-0.5 accent-emerald-600" checked={selected} onChange={onSelect} />
        </label>
      </div>
      <div className="mt-2 grid grid-cols-3 border-t border-slate-100 pt-2 text-center">
        <Metric label="기여도" grade={v.contribution} ratio={v.contributionRatio} />
        <Metric label="성과도" grade={v.performance} ratio={v.performanceRatio} />
        <Metric label="노출확률" grade={v.exposure} ratio={v.exposureRatio} />
      </div>
    </div>
  );
}

function Metric({ label, grade, ratio }: { label: string; grade: Grade | null; ratio: number | null }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-slate-500">{label}</span>
      <GradeBadge grade={grade} ratio={ratio} />
    </div>
  );
}

function VideoTable({
  list, selected, onSelect,
}: { list: VideoResult[]; selected: Set<string>; onSelect: (id: string) => void }) {
  return (
    <div className="card mt-3 overflow-x-auto">
      <table className="w-full min-w-[960px] text-sm">
        <thead className="whitespace-nowrap bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-3 font-medium">선택</th>
            <th className="px-2 py-3 font-medium">CC</th>
            <th className="px-3 py-3 font-medium">썸네일</th>
            <th className="px-3 py-3 text-left font-medium">제목</th>
            <th className="px-3 py-3 font-medium">조회수</th>
            <th className="px-3 py-3 font-medium">구독자</th>
            <th className="px-3 py-3 font-medium">기여도</th>
            <th className="px-3 py-3 font-medium">성과도</th>
            <th className="px-3 py-3 font-medium">노출확률</th>
            <th className="px-3 py-3 font-medium">총 영상 수</th>
            <th className="px-3 py-3 font-medium">게시일</th>
          </tr>
        </thead>
        <tbody>
          {list.map((v) => (
            <tr key={v.id} className={`border-t border-slate-100 ${selected.has(v.id) ? "bg-emerald-50/50" : ""}`}>
              <td className="px-3 py-2 text-center">
                <input type="checkbox" className="accent-emerald-600" checked={selected.has(v.id)} onChange={() => onSelect(v.id)} />
              </td>
              <td className="px-2 py-2 text-center text-xs text-slate-500">{v.hasCaption ? "CC" : ""}</td>
              <td className="px-3 py-2">
                <Thumb v={v} className="h-[68px] w-[120px]" />
              </td>
              <td className="max-w-[340px] px-3 py-2">
                <span className="line-clamp-2">{v.title}</span>
              </td>
              <td className="px-3 py-2 text-center tabular-nums">{v.views.toLocaleString("ko-KR")}</td>
              <td className="px-3 py-2 text-center">
                <div className="tabular-nums">{v.subscribers?.toLocaleString("ko-KR") ?? "비공개"}</div>
                <div className="mx-auto max-w-[110px] truncate text-xs text-slate-500">{v.channelTitle}</div>
              </td>
              <td className="px-3 py-2 text-center"><GradeBadge grade={v.contribution} ratio={v.contributionRatio} /></td>
              <td className="px-3 py-2 text-center"><GradeBadge grade={v.performance} ratio={v.performanceRatio} /></td>
              <td className="px-3 py-2 text-center"><GradeBadge grade={v.exposure} ratio={v.exposureRatio} /></td>
              <td className="px-3 py-2 text-center tabular-nums">{v.channelVideoCount.toLocaleString("ko-KR")}</td>
              <td className="px-3 py-2 text-center tabular-nums">{fmtDate(v.publishedAt).slice(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricHelp() {
  return (
    <div className="card mb-5 grid gap-4 p-5 text-sm text-slate-600 md:grid-cols-3">
      <div>
        <p className="font-semibold text-slate-800">성과도 = 조회수 ÷ 구독자</p>
        <p className="mt-1">구독자 규모에 비해 얼마나 멀리 퍼졌는지. 작은 채널이 크게 터진 영상을 찾을 때 씁니다.</p>
        <p className="mt-1 text-xs">Great 10배↑ · Good 2배↑ · Normal 0.5배↑ · Bad 0.1배↑ · Worst 그 미만</p>
      </div>
      <div>
        <p className="font-semibold text-slate-800">기여도 = 조회수 ÷ 채널 평균 조회수</p>
        <p className="mt-1">그 채널의 영상 1개당 평균 조회수보다 얼마나 튀었는지. 주제·제목·썸네일이 먹힌 영상입니다.</p>
        <p className="mt-1 text-xs">Great 5배↑ · Good 2배↑ · Normal 0.7배↑ · Bad 0.3배↑ · Worst 그 미만</p>
      </div>
      <div>
        <p className="font-semibold text-slate-800">노출확률 (추정)</p>
        <p className="mt-1">
          하루 평균 조회수를 채널의 평소 속도(평균 조회수 ÷ 30일)와 비교합니다. 높을수록 지금도 추천을 타고 있을
          가능성이 큽니다. 조회수 변화 이력 없이 계산한 어림값입니다.
        </p>
        <p className="mt-1 text-xs">Great 4배↑ · Good 1.5배↑ · Normal 0.7배↑ · Bad 0.3배↑ · Worst 그 미만</p>
      </div>
      <p className="text-xs text-slate-400 md:col-span-3">
        뷰트랩 등 기존 서비스의 실제 계산식은 공개돼 있지 않아, 위 기준은 이 서비스가 따로 정한 것입니다. 등급에 마우스를 올리면 실제 배수가 보입니다.
      </p>
    </div>
  );
}
