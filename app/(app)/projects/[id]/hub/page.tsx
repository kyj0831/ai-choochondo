"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Hub, HubLink, HubService } from "@/lib/types";

interface Readiness {
  score: number;
  items: { label: string; ok: boolean; hint: string }[];
}
interface PublishCheck {
  ok: boolean;
  blockers: string[];
}
interface CrawlSummary {
  total: number;
  byOperator: { operator: string; bots: string[]; count: number; last_seen: string }[];
}
interface CrawlRow {
  id: string;
  bot_label: string;
  operator: string;
  path: string;
  created_at: string;
}
interface HubEffect {
  stage: "not_published" | "awaiting_crawl" | "crawled" | "cited" | "measured";
  headline: string;
  detail: string;
  publishedAt: string | null;
  score: { before: number; after: number; delta: number } | null;
  axes: { axis: string; label: string; before: number; after: number; max: number; delta: number }[];
  citation: { citedCount: number; totalAfter: number; engines: string[]; sampleQueries: string[] };
  crawl: { total: number; operators: string[]; firstSeen: string | null };
}

const STAGE_STEPS: { key: HubEffect["stage"]; label: string }[] = [
  { key: "not_published", label: "발행" },
  { key: "awaiting_crawl", label: "수집 대기" },
  { key: "crawled", label: "AI 수집 확인" },
  { key: "cited", label: "답변에 인용" },
  { key: "measured", label: "점수 변화" },
];

const DRAFT_MARK = "[초안]";
const isDraft = (s: string) => s.trim().startsWith(DRAFT_MARK);

/**
 * API 응답을 읽고, 실패를 반드시 '문장'으로 바꾼다.
 *
 * 이 화면이 통째로 비어 보이는 사고가 있었다. 원인은 응답을 확인하지 않은 것이었다 —
 * 서버가 500(HTML 에러 페이지)을 주면 res.json()이 던지고, 로딩 상태가 끝나지 않아
 * "불러오는 중..."에서 멈춘다. 회색 작은 글씨 한 줄이라 사용자에게는 빈 화면이다.
 * 그래서 여기서 모든 실패 경로를 사람이 읽는 한국어로 만든다.
 */
async function readApi(res: Response): Promise<Record<string, any>> {
  const text = await res.text();
  let data: Record<string, any> = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // JSON이 아니면 서버 에러 페이지이거나 로그인 화면이 넘어온 것이다.
      throw new Error(
        `서버가 예상과 다른 응답을 보냈습니다 (HTTP ${res.status}). 서버가 켜져 있는지 확인해 주세요.`
      );
    }
  }
  if (res.status === 401) throw new Error("접속 권한이 만료되었습니다. 다시 로그인해 주세요.");
  if (!res.ok) {
    const err = new Error(String(data.error || `요청이 실패했습니다 (HTTP ${res.status}).`));
    (err as any).blockers = data.blockers;
    throw err;
  }
  return data;
}

function messageOf(e: unknown, fallback: string): string {
  // fetch가 서버에 닿지도 못하면 TypeError("Failed to fetch")를 던진다.
  // 브라우저 원문을 그대로 띄우면 사용자가 할 수 있는 일이 없으므로 우리 문장으로 바꾼다.
  if (e instanceof TypeError) return `${fallback} (서버에 연결하지 못했습니다)`;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

const ACCENT_OPTIONS = [
  { key: "indigo", cls: "bg-indigo-600" },
  { key: "emerald", cls: "bg-emerald-600" },
  { key: "rose", cls: "bg-rose-600" },
  { key: "amber", cls: "bg-amber-500" },
  { key: "slate", cls: "bg-slate-800" },
];

export default function HubEditorPage({ params }: { params: { id: string } }) {
  const [hub, setHub] = useState<Hub | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [publishCheck, setPublishCheck] = useState<PublishCheck | null>(null);
  const [skipped, setSkipped] = useState<{ faq: number; services: number } | null>(null);
  const [facts, setFacts] = useState<{ key: string; value: string }[]>([]);
  const [crawlSummary, setCrawlSummary] = useState<CrawlSummary | null>(null);
  const [crawls, setCrawls] = useState<CrawlRow[]>([]);
  const [effect, setEffect] = useState<HubEffect | null>(null);
  const [missedQueries, setMissedQueries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setOrigin(window.location.origin), []);

  const load = useCallback(async () => {
    try {
      const data = await readApi(await fetch(`/api/projects/${params.id}/hub`));
      setHub(data.hub);
      setReadiness(data.readiness ?? null);
      setPublishCheck(data.publishCheck ?? null);
      setSkipped(data.skipped ?? null);
      setFacts(data.facts ?? []);
      setCrawlSummary(data.crawls?.summary ?? null);
      setCrawls(data.crawls?.recent ?? []);
      setEffect(data.effect ?? null);
      setMissedQueries(data.missedQueries ?? []);
      setLoadError(null);
    } catch (e) {
      setLoadError(messageOf(e, "허브 정보를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요."));
    } finally {
      // 성공하든 실패하든 로딩은 반드시 끝낸다. 이걸 빠뜨리면 화면이 영영 멈춘다.
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createHub() {
    setCreating(true);
    setErrorMsg(null);
    try {
      await readApi(await fetch(`/api/projects/${params.id}/hub`, { method: "POST" }));
      await load();
    } catch (e) {
      setErrorMsg(messageOf(e, "허브 초안을 만들지 못했습니다."));
    } finally {
      setCreating(false);
    }
  }

  /** 로컬 상태를 즉시 반영하고 저장은 디바운스한다. */
  function patch(changes: Partial<Hub>, immediate = false) {
    setHub((prev) => (prev ? { ...prev, ...changes } : prev));
    setErrorMsg(null);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const run = () => save(changes);
    if (immediate) run();
    else saveTimer.current = setTimeout(run, 600);
  }

  async function save(changes: Partial<Hub>) {
    setSaveState("saving");
    try {
      const data = await readApi(
        await fetch(`/api/projects/${params.id}/hub`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        })
      );
      setHub(data.hub);
      setReadiness(data.readiness ?? null);
      setPublishCheck(data.publishCheck ?? null);
      setSkipped(data.skipped ?? null);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    } catch (e) {
      setSaveState("error");
      setErrorMsg(messageOf(e, "저장에 실패했습니다."));
    }
  }

  async function togglePublish() {
    if (!hub) return;
    try {
      const data = await readApi(
        await fetch(`/api/projects/${params.id}/hub`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ published: !hub.published }),
        })
      );
      setHub(data.hub);
      setPublishCheck(data.publishCheck ?? null);
      setSkipped(data.skipped ?? null);
      setErrorMsg(null);
    } catch (e) {
      const blockers = (e as any)?.blockers;
      if (Array.isArray(blockers) && blockers.length) {
        // 할 일 목록은 바로 아래 카드에 그대로 뜬다.
        // "아직 발행할 수 없습니다." 한 줄을 위에 또 띄우면 같은 말이 두 번 나올 뿐,
        // 무엇을 해야 하는지는 알려주지 않는다.
        setPublishCheck({ ok: false, blockers });
        setErrorMsg(null);
      } else {
        setErrorMsg(messageOf(e, "발행할 수 없습니다."));
      }
    }
  }

  if (loading) return <p className="text-sm text-slate-400">불러오는 중...</p>;

  // ---- 불러오기 자체가 실패한 경우 ----
  // 빈 화면 대신 원인과 다음 행동을 보여준다.
  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card p-8">
          <h1 className="text-xl font-bold mb-3">허브 화면을 열지 못했습니다</h1>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mb-5">{loadError}</div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setLoading(true);
                load();
              }}
              className="btn-primary"
            >
              다시 시도
            </button>
            <Link href={`/projects/${params.id}/report`} className="btn-ghost">
              ← 리포트로
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---- 아직 허브가 없는 경우 ----
  if (!hub) {
    return (
      <div className="max-w-2xl mx-auto">
        {errorMsg && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>
        )}
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-bold mb-3">AI 프로필 허브 만들기</h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-2">
            진단에서 드러난 문제 — 정보가 여러 채널에 흩어져 AI가 무엇이 공식 정보인지 판단하지 못하는 상태 —를
            해결하는 단일 공식 페이지를 만듭니다.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            공식 채널·지역·키워드는 이미 입력하신 값에서 자동으로 채워집니다. 소개 문구는 초안만 제시하며,
            <strong className="text-slate-800"> 직접 확인·수정해야 발행됩니다.</strong>
          </p>
          <button onClick={createHub} disabled={creating} className="btn-primary">
            {creating ? "생성 중..." : "리포트에서 허브 초안 만들기"}
          </button>
        </div>
      </div>
    );
  }

  const publicUrl = `${origin}/p/${hub.slug}`;
  const usedFaqQuestions = new Set(hub.faq.map((f) => f.q));
  const suggestableQueries = missedQueries.filter((q) => !usedFaqQuestions.has(q));

  return (
    <div className="max-w-3xl mx-auto pb-20">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">AI 프로필 허브</h1>
          <p className="text-xs text-slate-400 mt-1">
            {hub.published ? "발행됨" : "비공개 (편집 중)"} ·{" "}
            {saveState === "saving" ? "저장 중..." : saveState === "saved" ? "저장됨" : ""}
          </p>
        </div>
        <Link href={`/projects/${params.id}/report`} className="btn-ghost shrink-0">
          ← 리포트로
        </Link>
      </div>

      {errorMsg && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>
      )}

      {/* 발행 상태 카드 */}
      <div className="card p-6 mb-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="min-w-0">
            <p className="label !mb-1">공개 주소</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-400">{origin}/p/</span>
              <input
                value={hub.slug}
                onChange={(e) => patch({ slug: e.target.value })}
                className="input !w-auto flex-1 font-mono text-sm"
              />
            </div>
          </div>
          <button
            onClick={togglePublish}
            className={hub.published ? "btn-secondary shrink-0" : "btn-primary shrink-0"}
          >
            {hub.published ? "비공개로 전환" : "발행하기"}
          </button>
        </div>

        {hub.published ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-emerald-50 px-4 py-3">
            <a href={publicUrl} target="_blank" className="text-sm font-medium text-emerald-700 underline">
              {publicUrl}
            </a>
            <a href={`${publicUrl}/llms.txt`} target="_blank" className="btn-ghost !text-emerald-700">
              llms.txt 보기
            </a>
          </div>
        ) : (
          publishCheck &&
          !publishCheck.ok && (
            <div className="rounded-lg bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-800 mb-1.5">발행하려면 아래를 먼저 정리하세요</p>
              <ul className="space-y-1">
                {publishCheck.blockers.map((b) => (
                  <li key={b} className="text-xs text-amber-900">
                    · {b}
                  </li>
                ))}
              </ul>
            </div>
          )
        )}

        {/*
          비어 있는 항목은 발행을 막지 않는다 — 공개 페이지에 아예 나가지 않기 때문이다.
          다만 "왜 내 FAQ가 안 보이지?"를 나중에 겪지 않도록 미리 알린다.
        */}
        {skipped && (skipped.faq > 0 || skipped.services > 0) && (
          <p className="mt-3 text-xs text-slate-500">
            비워둔 항목
            {skipped.faq > 0 && ` FAQ ${skipped.faq}개`}
            {skipped.faq > 0 && skipped.services > 0 && " ·"}
            {skipped.services > 0 && ` 서비스 ${skipped.services}개`}
            는 공개 페이지에 표시되지 않습니다. 지금 발행해도 되고, 나중에 채워 넣어도 됩니다.
          </p>
        )}
      </div>

      {/* 허브 효과 추적 — 발행에서 점수 변화까지의 단계를 관측치로 보여준다 */}
      {hub.published && effect && (
        <div className="card p-6 mb-5 border-2 border-indigo-200">
          <h2 className="font-semibold mb-1">{effect.headline}</h2>
          <p className="text-sm text-slate-600 mb-5">{effect.detail}</p>

          {/* 단계 표시 */}
          <ol className="flex items-center gap-1 mb-5">
            {STAGE_STEPS.map((s, i) => {
              const currentIdx = STAGE_STEPS.findIndex((x) => x.key === effect.stage);
              const done = i <= currentIdx;
              return (
                <li key={s.key} className="flex-1">
                  <div className={`h-1.5 rounded-full ${done ? "bg-indigo-500" : "bg-slate-200"}`} />
                  <p className={`mt-1.5 text-[11px] ${done ? "text-indigo-700 font-medium" : "text-slate-400"}`}>
                    {s.label}
                  </p>
                </li>
              );
            })}
          </ol>

          {/* 점수 변화 */}
          {effect.score && (
            <div className="rounded-xl bg-slate-50 p-4 mb-4">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-sm text-slate-400">발행 전 {effect.score.before}</span>
                <span className="text-slate-300">→</span>
                <span className="text-2xl font-bold">{effect.score.after}</span>
                <span
                  className={`text-sm font-semibold ${
                    effect.score.delta >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {effect.score.delta >= 0 ? "+" : ""}
                  {effect.score.delta}
                </span>
              </div>
              <div className="space-y-1.5">
                {effect.axes
                  .filter((a) => a.delta !== 0)
                  .map((a) => (
                    <div key={a.axis} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{a.label}</span>
                      <span className="tabular-nums text-slate-400">
                        {a.before} → {a.after}
                        <span
                          className={`ml-2 font-semibold ${
                            a.delta >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}
                        >
                          {a.delta >= 0 ? "+" : ""}
                          {a.delta}
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* 인용 채택 — 허브가 실제 AI 답변의 근거로 쓰였는지 */}
          {effect.citation.citedCount > 0 && (
            <div className="rounded-xl bg-emerald-50 p-4 mb-4">
              <p className="text-sm font-semibold text-emerald-800 mb-1">
                AI 답변 {effect.citation.citedCount}건이 이 허브를 근거로 인용했습니다
              </p>
              <p className="text-xs text-emerald-700 mb-2">
                인용 엔진: {effect.citation.engines.join(", ")}
              </p>
              {effect.citation.sampleQueries.length > 0 && (
                <ul className="space-y-1">
                  {effect.citation.sampleQueries.map((q) => (
                    <li key={q} className="text-xs text-emerald-900">
                      · {q}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-400">
            점수 변화는 허브 외 다른 채널 수정의 영향도 함께 받습니다. 인과가 아닌 관측치입니다.
          </p>
        </div>
      )}

      {/* AI 크롤러 접근 로그 — 진단 서비스만 보여줄 수 있는 지표 */}
      {hub.published && (
        <div className="card p-6 mb-5">
          <h2 className="font-semibold mb-1">AI가 이 페이지를 읽어갔는가</h2>
          <p className="text-xs text-slate-400 mb-4">
            허브를 직접 서빙하므로 AI 사업자 봇의 방문을 관측할 수 있습니다. User-Agent 기반 관측치입니다.
          </p>
          {crawlSummary && crawlSummary.total > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {crawlSummary.byOperator.map((o) => (
                  <div key={o.operator} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-400">{o.operator}</p>
                    <p className="text-lg font-bold">{o.count}회</p>
                    <p className="text-[11px] text-slate-400 truncate">{o.bots.join(", ")}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      최근 {new Date(o.last_seen + "Z").toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                ))}
              </div>
              <details>
                <summary className="text-xs text-slate-500 cursor-pointer">최근 접근 기록 {crawls.length}건</summary>
                <ul className="mt-2 space-y-1">
                  {crawls.map((c) => (
                    <li key={c.id} className="text-xs text-slate-500 flex gap-3">
                      <span className="text-slate-400 tabular-nums">
                        {new Date(c.created_at + "Z").toLocaleString("ko-KR")}
                      </span>
                      <span className="font-medium">{c.bot_label}</span>
                      <span className="text-slate-400 truncate">{c.path}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              아직 AI 크롤러 방문이 없습니다. 발행 직후에는 수집까지 며칠에서 몇 주가 걸립니다.
            </p>
          )}
        </div>
      )}

      {/* 완성도 */}
      {readiness && (
        <div className="card p-6 mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">AI 가독성 완성도</h2>
            <span className="text-lg font-bold text-brand-600">{readiness.score}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${readiness.score}%` }} />
          </div>
          <ul className="space-y-2">
            {readiness.items.map((it) => (
              <li key={it.label} className="flex items-start gap-2">
                <span className={`text-sm shrink-0 ${it.ok ? "text-emerald-500" : "text-slate-300"}`}>
                  {it.ok ? "✓" : "○"}
                </span>
                <div>
                  <p className={`text-sm ${it.ok ? "text-slate-400 line-through" : "font-medium text-slate-700"}`}>
                    {it.label}
                  </p>
                  {!it.ok && <p className="text-xs text-slate-500">{it.hint}</p>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        확인된 사실 — 기본 정보 단계에서 입력한 기준선이 그대로 실린다.
        여기서는 읽기만 한다. 두 곳에서 편집하게 하면 진단의 정답지와 허브의 공식 정보가
        어긋나기 시작한다. 정답지는 하나여야 한다.
      */}
      <div className="card p-6 mb-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h2 className="font-semibold">확인된 사실</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              허브가 존재하는 이유입니다. AI가 틀리게 말하는 영업시간·주소·영업 상태를 여기서 못 박습니다.
            </p>
          </div>
          <Link href={`/projects/${params.id}/setup`} className="btn-ghost shrink-0 text-xs">
            기본 정보에서 수정 →
          </Link>
        </div>
        {facts.length > 0 ? (
          <dl className="rounded-lg bg-slate-50 divide-y divide-slate-200">
            {facts.map((f) => (
              <div key={f.key} className="grid grid-cols-[7rem_1fr] gap-3 px-4 py-2.5">
                <dt className="text-sm text-slate-500">{f.key}</dt>
                <dd className="text-sm text-slate-900 whitespace-pre-line">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            아직 입력된 사실이 없습니다. 이 상태로 발행하면 허브에 소개문만 실리고, AI가 틀린 영업시간·주소를 고칠
            재료가 없습니다.{" "}
            <Link href={`/projects/${params.id}/setup`} className="underline font-medium">
              기본 정보에서 입력하기
            </Link>
          </div>
        )}
      </div>

      {/* 정체성 */}
      <div className="card p-6 mb-5 space-y-4">
        <h2 className="font-semibold">정체성</h2>

        <div>
          <label className="label">표시 이름</label>
          <input value={hub.display_name} onChange={(e) => patch({ display_name: e.target.value })} className="input" />
        </div>

        <div>
          <label className="label">한 줄 직함·소개</label>
          <input
            value={hub.headline}
            onChange={(e) => patch({ headline: e.target.value })}
            placeholder="예: 전 CBS 기자 · AI 커뮤니케이션 강사"
            className="input"
          />
        </div>

        <div>
          <label className="label">
            1문장 정의 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={hub.one_liner}
            onChange={(e) => patch({ one_liner: e.target.value })}
            rows={2}
            placeholder="누가 · 누구에게 · 무엇을 제공하는지 한 문장으로"
            className={`input ${isDraft(hub.one_liner) ? "border-amber-400 bg-amber-50" : ""}`}
          />
          {isDraft(hub.one_liner) ? (
            <p className="mt-1.5 text-xs text-amber-700">
              자동 초안입니다. AI가 이 문장을 그대로 인용하므로 본인 표현으로 고쳐야 발행됩니다.{" "}
              <button
                onClick={() => patch({ one_liner: hub.one_liner.replace(DRAFT_MARK, "").trim() }, true)}
                className="underline font-medium"
              >
                초안 표시 지우기
              </button>
            </p>
          ) : (
            <p className="mt-1.5 text-xs text-slate-400">AI 답변에 가장 많이 인용되는 문장입니다.</p>
          )}
        </div>

        <div>
          <label className="label">소개문</label>
          <textarea
            value={hub.bio}
            onChange={(e) => patch({ bio: e.target.value })}
            rows={4}
            placeholder="대상 · 해결하는 문제 · 제공 가치를 각각 한 문장씩"
            className={`input ${isDraft(hub.bio) ? "border-amber-400 bg-amber-50" : ""}`}
          />
          {isDraft(hub.bio) && (
            <p className="mt-1.5 text-xs text-amber-700">
              자동 초안입니다.{" "}
              <button
                onClick={() => patch({ bio: hub.bio.replace(DRAFT_MARK, "").trim() }, true)}
                className="underline font-medium"
              >
                초안 표시 지우기
              </button>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">활동 지역</label>
            <input value={hub.region} onChange={(e) => patch({ region: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">문의 이메일</label>
            <input
              value={hub.contact_email ?? ""}
              onChange={(e) => patch({ contact_email: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <TagField
          label="전문 분야 키워드"
          hint="범주형 추천 질의에서 후보로 잡히기 위한 신호입니다."
          values={hub.keywords}
          onChange={(v) => patch({ keywords: v })}
        />
        <TagField
          label="주요 대상"
          hint="누구를 위한 서비스인지 명시하면 상황형 질의에 걸립니다."
          values={hub.audiences}
          onChange={(v) => patch({ audiences: v })}
        />

        <div>
          <label className="label">색상</label>
          <div className="flex gap-2">
            {ACCENT_OPTIONS.map((a) => (
              <button
                key={a.key}
                onClick={() => patch({ accent: a.key }, true)}
                className={`w-8 h-8 rounded-lg ${a.cls} ${
                  hub.accent === a.key ? "ring-2 ring-offset-2 ring-slate-400" : ""
                }`}
                aria-label={a.key}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 공식 채널 */}
      <LinksEditor links={hub.links} onChange={(v) => patch({ links: v })} />

      {/* 제공 서비스 */}
      <ServicesEditor services={hub.services} onChange={(v) => patch({ services: v })} />

      {/* FAQ */}
      <FaqEditor
        faq={hub.faq}
        suggestions={suggestableQueries}
        onChange={(v) => patch({ faq: v })}
      />
    </div>
  );
}

// ---- 하위 편집 컴포넌트 ----

function TagField({
  label,
  hint,
  values,
  onChange,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (!v || values.includes(v)) return setInput("");
    onChange([...values, v]);
    setInput("");
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v) => (
          <span key={v} className="badge bg-slate-100 text-slate-700 gap-1">
            {v}
            <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-slate-400 hover:text-red-500">
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="입력 후 Enter"
          className="input"
        />
        <button onClick={add} className="btn-secondary shrink-0">
          추가
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function LinksEditor({ links, onChange }: { links: HubLink[]; onChange: (v: HubLink[]) => void }) {
  const [url, setUrl] = useState("");

  function add() {
    const v = url.trim();
    if (!v) return;
    const normalized = /^https?:\/\//.test(v) ? v : `https://${v}`;
    if (links.some((l) => l.url === normalized)) return setUrl("");
    onChange([...links, { label: "", url: normalized, platform: "website" }]);
    setUrl("");
  }

  return (
    <div className="card p-6 mb-5">
      <h2 className="font-semibold mb-1">공식 채널</h2>
      <p className="text-xs text-slate-400 mb-4">
        여기 등록된 URL은 구조화 데이터의 <code className="text-slate-500">sameAs</code>로 선언되어, 흩어진 채널이
        같은 주체임을 AI에게 알립니다.
      </p>

      <ul className="space-y-2 mb-3">
        {links.map((l, i) => (
          <li key={l.url} className="flex gap-2 items-center">
            <input
              value={l.label}
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...l, label: e.target.value };
                onChange(next);
              }}
              placeholder="표시 이름"
              className="input !w-32 shrink-0"
            />
            <input
              value={l.url}
              onChange={(e) => {
                const next = [...links];
                next[i] = { ...l, url: e.target.value };
                onChange(next);
              }}
              className="input font-mono text-xs"
            />
            <button
              onClick={() => onChange(links.filter((_, x) => x !== i))}
              className="btn-ghost text-slate-400 hover:text-red-500 shrink-0"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>

      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="https://instagram.com/..."
          className="input"
        />
        <button onClick={add} className="btn-secondary shrink-0">
          추가
        </button>
      </div>
    </div>
  );
}

function ServicesEditor({ services, onChange }: { services: HubService[]; onChange: (v: HubService[]) => void }) {
  return (
    <div className="card p-6 mb-5">
      <h2 className="font-semibold mb-1">제공 서비스</h2>
      <p className="text-xs text-slate-400 mb-4">
        설명이 비어 있으면 구조화 데이터에 포함하지 않습니다. 빈 껍데기를 공식 정보로 선언하지 않기 위해서입니다.
      </p>

      <div className="space-y-3 mb-3">
        {services.map((s, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="flex gap-2 mb-2">
              <input
                value={s.title}
                onChange={(e) => {
                  const next = [...services];
                  next[i] = { ...s, title: e.target.value };
                  onChange(next);
                }}
                placeholder="서비스명"
                className="input font-medium"
              />
              <button
                onClick={() => onChange(services.filter((_, x) => x !== i))}
                className="btn-ghost text-slate-400 hover:text-red-500 shrink-0"
              >
                삭제
              </button>
            </div>
            <textarea
              value={s.description}
              onChange={(e) => {
                const next = [...services];
                next[i] = { ...s, description: e.target.value };
                onChange(next);
              }}
              rows={2}
              placeholder="누구에게 무엇을 어떻게 제공하는지"
              className={`input ${s.title.trim() && !s.description.trim() ? "border-amber-300 bg-amber-50" : ""}`}
            />
          </div>
        ))}
      </div>

      <button onClick={() => onChange([...services, { title: "", description: "" }])} className="btn-secondary">
        + 서비스 추가
      </button>
    </div>
  );
}

function FaqEditor({
  faq,
  suggestions,
  onChange,
}: {
  faq: { q: string; a: string }[];
  suggestions: string[];
  onChange: (v: { q: string; a: string }[]) => void;
}) {
  return (
    <div className="card p-6 mb-5">
      <h2 className="font-semibold mb-1">자주 묻는 질문</h2>
      <p className="text-xs text-slate-400 mb-4">
        질문-답 구조는 AI가 가장 인용하기 쉬운 형식입니다. 아래 질문들은 진단에서{" "}
        <strong className="text-slate-600">실제로 브랜드가 후보에 오르지 못한 질의</strong>입니다.
      </p>

      {suggestions.length > 0 && (
        <div className="mb-4 rounded-xl bg-brand-50 p-4">
          <p className="text-xs font-semibold text-brand-700 mb-2">
            AI가 당신을 빠뜨린 질문 {suggestions.length}개 — 클릭해서 FAQ에 추가
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((q) => (
              <button
                key={q}
                onClick={() => onChange([...faq, { q, a: "" }])}
                className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 ring-1 ring-brand-200 hover:ring-brand-400 text-left"
              >
                + {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3 mb-3">
        {faq.map((f, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-3">
            <div className="flex gap-2 mb-2">
              <input
                value={f.q}
                onChange={(e) => {
                  const next = [...faq];
                  next[i] = { ...f, q: e.target.value };
                  onChange(next);
                }}
                placeholder="질문"
                className="input font-medium"
              />
              <button
                onClick={() => onChange(faq.filter((_, x) => x !== i))}
                className="btn-ghost text-slate-400 hover:text-red-500 shrink-0"
              >
                삭제
              </button>
            </div>
            <textarea
              value={f.a}
              onChange={(e) => {
                const next = [...faq];
                next[i] = { ...f, a: e.target.value };
                onChange(next);
              }}
              rows={3}
              placeholder="2~3문장으로 직접 답하세요. 지어낸 실적·고객사는 쓰지 마세요."
              className={`input ${f.q.trim() && !f.a.trim() ? "border-amber-300 bg-amber-50" : ""}`}
            />
          </div>
        ))}
      </div>

      <button onClick={() => onChange([...faq, { q: "", a: "" }])} className="btn-secondary">
        + 직접 추가
      </button>
    </div>
  );
}
