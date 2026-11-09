"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Analysis, Board, RefItem, Remix } from "@/lib/bibl";

function fmtCount(n: number | null | undefined): string {
  if (n == null) return "비공개";
  if (n >= 100_000_000) return `${+(n / 100_000_000).toFixed(1)}억`;
  if (n >= 10_000) return `${+(n / 10_000).toFixed(1)}만`;
  return n.toLocaleString("ko-KR");
}
function ratio(r: number | null): string {
  if (r == null) return "-";
  return r >= 10 ? `${Math.round(r)}배` : `${r.toFixed(1)}배`;
}

export default function RefPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [ref, setRef] = useState<RefItem | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [remixes, setRemixes] = useState<Remix[]>([]);
  const [notFound, setNotFound] = useState(false);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  const [topic, setTopic] = useState("");
  const [remixing, setRemixing] = useState(false);
  const [remixErr, setRemixErr] = useState<string | null>(null);

  async function runAnalyze(refresh = false) {
    setAnalyzing(true);
    setAnalyzeErr(null);
    try {
      const res = await fetch(`/api/bibl/refs/${params.id}/analyze${refresh ? "?refresh=1" : ""}`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "해부하지 못했습니다.");
      setAnalysis(d.analysis);
    } catch (e) {
      setAnalyzeErr(e instanceof Error ? e.message : "해부하지 못했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  useEffect(() => {
    fetch(`/api/bibl/refs/${params.id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        setRef(d.ref);
        setBoards(d.boards);
        setRemixes(d.remixes);
        setNote(d.ref.note);
        setTags(d.ref.tags.join(", "));
        if (d.ref.analysis) setAnalysis(d.ref.analysis);
        else runAnalyze();
      })
      .catch(() => setNotFound(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function patch(body: object) {
    const res = await fetch(`/api/bibl/refs/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (res.ok) setRef(d.ref);
    return res.ok;
  }

  async function saveNote() {
    const ok = await patch({ note, tags: tags.split(/[,\s]+/).filter(Boolean) });
    if (ok) {
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    }
  }

  async function remove() {
    if (!confirm("이 레퍼를 보관함에서 지울까요? 해부와 내 버전 기록도 함께 지워집니다.")) return;
    await fetch(`/api/bibl/refs/${params.id}`, { method: "DELETE" });
    router.push("/bibl/library");
  }

  async function remix() {
    if (!topic.trim()) return;
    setRemixing(true);
    setRemixErr(null);
    try {
      const res = await fetch(`/api/bibl/refs/${params.id}/remix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "만들지 못했습니다.");
      setRemixes((r) => [d.remix, ...r]);
    } catch (e) {
      setRemixErr(e instanceof Error ? e.message : "만들지 못했습니다.");
    } finally {
      setRemixing(false);
    }
  }

  if (notFound)
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center">
        <p className="font-semibold">이 레퍼를 찾을 수 없어요</p>
        <p className="mt-2 text-sm text-stone-500">지웠거나, 다른 기기의 보관함에 있는 레퍼일 수 있어요.</p>
        <Link href="/bibl/library" className="mt-4 inline-block text-orange-600 underline">내 보관함으로</Link>
      </div>
    );
  if (!ref) return <p className="mt-10 text-center text-stone-400">불러오는 중…</p>;

  const v = ref.video;
  const url = `https://www.youtube.com/watch?v=${v.id}`;

  return (
    <div>
      <Link href="/bibl/library" className="text-sm text-stone-500 hover:underline">← 내 보관함</Link>

      <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        {/* ── 왼쪽: 영상 ── */}
        <div>
          <a href={url} target="_blank" rel="noreferrer" className="block aspect-video overflow-hidden rounded-2xl bg-stone-200">
            {v.thumbnail && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`} alt="" className="h-full w-full object-cover" />
            )}
          </a>
          <h1 className="mt-3 text-xl font-bold leading-snug">{v.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {v.channelTitle} · 구독자 {fmtCount(v.subscribers)} · {v.publishedAt.slice(0, 10)} ·{" "}
            <a href={url} target="_blank" rel="noreferrer" className="underline">YouTube에서 보기</a>
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat label="조회수" value={fmtCount(v.views)} />
            <Stat label="성과도 (구독자 대비)" value={ratio(v.performanceRatio)} sub={v.performance ?? ""} />
            <Stat label="기여도 (채널 평균 대비)" value={ratio(v.contributionRatio)} sub={v.contribution ?? ""} />
          </div>

          {/* 배운 점 */}
          <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">내가 배운 점</h2>
              {analysis?.lessonDraft && (
                <button className="text-xs font-semibold text-orange-700 underline" onClick={() => setNote(analysis.lessonDraft)}>
                  AI 초안 넣기
                </button>
              )}
            </div>
            <textarea
              className="input mt-2 bg-white"
              rows={3}
              maxLength={500}
              placeholder="이 영상에서 내 채널에 가져갈 것 한 줄. 내 말로 쓸수록 감이 됩니다."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <input className="input mt-2 bg-white" placeholder="태그 (쉼표로 구분: 육아, 아침루틴)" value={tags} onChange={(e) => setTags(e.target.value)} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                className="input max-w-[200px] bg-white"
                value={ref.boardId ?? ""}
                onChange={(e) => patch({ boardId: e.target.value || null })}
              >
                <option value="">보드 없음</option>
                {boards.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white" onClick={saveNote}>
                {noteSaved ? "저장했어요 ✓" : "저장"}
              </button>
              <button className="ml-auto text-xs text-red-500 underline" onClick={remove}>레퍼 지우기</button>
            </div>
          </section>
        </div>

        {/* ── 오른쪽: 해부 ── */}
        <section className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">왜 터졌나 — 해부</h2>
            {analysis && !analyzing && (
              <button className="text-xs text-stone-500 underline" onClick={() => runAnalyze(true)}>다시 해부</button>
            )}
          </div>
          {analyzing && <p className="mt-6 text-center text-sm text-stone-400">썸네일과 제목을 뜯어보는 중… (10~20초)</p>}
          {analyzeErr && (
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {analyzeErr}
              <button className="ml-2 underline" onClick={() => runAnalyze()}>다시 시도</button>
            </div>
          )}
          {analysis && !analyzing && <AnalysisView a={analysis} />}
        </section>
      </div>

      {/* ── 내 버전 만들기 ── */}
      <section className="mt-8 rounded-2xl border-2 border-orange-200 bg-white p-5">
        <h2 className="text-lg font-bold">내 버전 만들기</h2>
        <p className="mt-1 text-sm text-stone-500">
          이 영상의 <b>구조</b>만 빌려, 내 주제로 제목 5안과 썸네일 3안을 만들어요. 문구를 베끼지 않습니다.
        </p>
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            remix();
          }}
        >
          <input
            className="input flex-1"
            placeholder="내 다음 영상 주제 (예: 워킹맘 15분 아침 준비 루틴)"
            value={topic}
            maxLength={100}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button
            type="submit"
            disabled={remixing || !topic.trim()}
            className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-40"
          >
            {remixing ? "만드는 중…" : "내 버전 만들기"}
          </button>
        </form>
        {remixErr && <p className="mt-2 text-sm text-red-600">{remixErr}</p>}

        <div className="mt-5 space-y-6">
          {remixes.map((r) => (
            <RemixView key={r.id} r={r} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-2 py-3">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
      {sub && <p className="text-xs font-semibold text-emerald-600">{sub}</p>}
    </div>
  );
}

const THUMB_ROWS: { key: keyof NonNullable<Analysis["thumbnail"]>; label: string }[] = [
  { key: "face", label: "얼굴·표정" },
  { key: "text", label: "문구" },
  { key: "color", label: "색·대비" },
  { key: "composition", label: "구도" },
  { key: "focus", label: "시선 유도" },
  { key: "titleRelation", label: "제목과의 관계" },
];

function AnalysisView({ a }: { a: Analysis }) {
  return (
    <div className="mt-4 space-y-5 text-sm">
      <div>
        <h3 className="font-semibold text-stone-800">잘된 이유</h3>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-stone-700">
          {a.whyItWorked.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ol>
      </div>

      <div>
        <h3 className="font-semibold text-stone-800">제목</h3>
        <div className="mt-2 flex flex-wrap gap-1">
          {a.title.hooks.map((h) => (
            <span key={h} className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">{h}</span>
          ))}
          {a.title.keyword && (
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">
              핵심어 &lsquo;{a.title.keyword}&rsquo; · {a.title.keywordPosition}
            </span>
          )}
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-600">{a.title.length}자</span>
        </div>
        <p className="mt-2 text-stone-700">{a.title.why}</p>
      </div>

      <div>
        <h3 className="font-semibold text-stone-800">썸네일</h3>
        {a.thumbnail ? (
          <dl className="mt-2 divide-y divide-stone-100 rounded-xl border border-stone-200">
            {THUMB_ROWS.map((r) => (
              <div key={r.key} className="grid grid-cols-[88px_1fr] gap-2 px-3 py-2">
                <dt className="text-stone-500">{r.label}</dt>
                <dd className="text-stone-800">{a.thumbnail![r.key] || "-"}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 rounded-lg bg-stone-50 p-3 text-stone-500">
            썸네일 해부는 AI 키(OPENAI_API_KEY 또는 ANTHROPIC_API_KEY)가 있어야 합니다. 지금은 제목과 숫자로만 해부했어요.
          </p>
        )}
      </div>

      <div className="rounded-xl bg-stone-900 p-4 text-white">
        <h3 className="font-semibold">내 영상에 가져갈 것</h3>
        <ul className="mt-2 space-y-1.5">
          {a.steal.map((s, i) => (
            <li key={i}>✓ {s}</li>
          ))}
        </ul>
      </div>
      {a.source === "rule" && <p className="text-xs text-stone-400">규칙 기반 해부 · AI 키를 넣으면 썸네일까지 더 깊게 해부합니다.</p>}
    </div>
  );
}

function RemixView({ r }: { r: Remix }) {
  const [copied, setCopied] = useState<number | null>(null);
  async function copy(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  }
  return (
    <div className="rounded-xl bg-stone-50 p-4">
      <p className="text-xs text-stone-500">
        주제: <b className="text-stone-800">{r.topic}</b> · {r.createdAt.slice(0, 10)}
        {r.result.source === "rule" && " · 템플릿 기반 (AI 키를 넣으면 더 자연스러워져요)"}
      </p>
      <h3 className="mt-3 text-sm font-semibold">제목 5안</h3>
      <ul className="mt-2 space-y-2">
        {r.result.titles.map((t, i) => (
          <li key={i} className="flex items-start gap-2 rounded-lg bg-white p-3 ring-1 ring-stone-200">
            <div className="flex-1">
              <p className="font-medium">{t.title}</p>
              <p className="mt-0.5 text-xs text-stone-500">
                <span className="font-semibold text-orange-700">{t.hook}</span> · {t.why}
              </p>
            </div>
            <button className="shrink-0 text-xs text-stone-500 underline" onClick={() => copy(i, t.title)}>
              {copied === i ? "복사됨" : "복사"}
            </button>
          </li>
        ))}
      </ul>
      <h3 className="mt-4 text-sm font-semibold">썸네일 3안</h3>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {r.result.thumbnails.map((t, i) => (
          <div key={i} className="rounded-lg bg-white p-3 ring-1 ring-stone-200">
            <div className="flex aspect-video items-center justify-center rounded-md bg-stone-900 px-2 text-center text-xl font-black text-yellow-300">
              {t.text}
            </div>
            <p className="mt-2 text-xs text-stone-700">{t.layout}</p>
            <p className="mt-1 text-xs text-stone-500">{t.why}</p>
          </div>
        ))}
      </div>
      {r.result.caution && <p className="mt-3 text-xs text-stone-500">⚠ {r.result.caution}</p>}
    </div>
  );
}
