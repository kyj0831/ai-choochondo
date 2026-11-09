"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Board, RefItem } from "@/lib/bibl";

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

export default function LibraryPage() {
  const [refs, setRefs] = useState<RefItem[] | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [board, setBoard] = useState<string>("all"); // all | none | board id
  const [view, setView] = useState<"cards" | "mood">("cards");
  const [q, setQ] = useState("");
  const [hook, setHook] = useState("");
  const [keyPath, setKeyPath] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/bibl/refs")
      .then((r) => r.json())
      .then((d) => {
        setRefs(d.refs ?? []);
        setBoards(d.boards ?? []);
      })
      .catch(() => {
        setError("보관함을 불러오지 못했습니다.");
        setRefs([]);
      });
    fetch("/api/bibl/key")
      .then((r) => r.json())
      .then((d) => setKeyPath(d.path))
      .catch(() => {});
  }
  useEffect(load, []);

  const hooks = useMemo(() => {
    const c = new Map<string, number>();
    for (const r of refs ?? []) for (const h of r.analysis?.title.hooks ?? []) c.set(h, (c.get(h) ?? 0) + 1);
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [refs]);

  const shown = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return (refs ?? []).filter(
      (r) =>
        (board === "all" || (board === "none" ? !r.boardId : r.boardId === board)) &&
        (!hook || r.analysis?.title.hooks.includes(hook)) &&
        (!kw ||
          r.video.title.toLowerCase().includes(kw) ||
          r.note.toLowerCase().includes(kw) ||
          r.video.channelTitle.toLowerCase().includes(kw) ||
          r.tags.some((t) => t.toLowerCase().includes(kw)))
    );
  }, [refs, board, hook, q]);

  async function newBoard() {
    const name = prompt("새 보드 이름 (예: 썸네일 잘 뽑은 것)");
    if (!name?.trim()) return;
    await fetch("/api/bibl/boards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    load();
  }

  async function renameCurrent() {
    const b = boards.find((x) => x.id === board);
    if (!b) return;
    const name = prompt("보드 이름 바꾸기", b.name);
    if (!name?.trim()) return;
    await fetch(`/api/bibl/boards/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    load();
  }

  async function deleteCurrent() {
    const b = boards.find((x) => x.id === board);
    if (!b || !confirm(`'${b.name}' 보드를 지울까요? 안의 레퍼는 지워지지 않고 '보드 없음'으로 옮겨집니다.`)) return;
    await fetch(`/api/bibl/boards/${b.id}`, { method: "DELETE" });
    setBoard("all");
    load();
  }

  async function copyKey() {
    if (!keyPath) return;
    try {
      await navigator.clipboard.writeText(location.origin + keyPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      prompt("아래 링크를 복사해 휴대폰에서 여세요", location.origin + keyPath);
    }
  }

  const total = refs?.length ?? 0;
  const noteless = (refs ?? []).filter((r) => !r.note.trim()).length;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">내 보관함</h1>
          <p className="mt-1 text-sm text-stone-500">
            레퍼 {total}개
            {noteless > 0 && <> · 배운 점이 비어 있는 레퍼 {noteless}개</>}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white p-1 text-sm">
          <button className={`rounded-lg px-3 py-1.5 ${view === "cards" ? "bg-stone-900 text-white" : "text-stone-500"}`} onClick={() => setView("cards")}>
            카드
          </button>
          <button className={`rounded-lg px-3 py-1.5 ${view === "mood" ? "bg-stone-900 text-white" : "text-stone-500"}`} onClick={() => setView("mood")}>
            썸네일 무드보드
          </button>
        </div>
      </div>

      {/* 보드 탭 */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {[
          { id: "all", name: "전체", count: total },
          { id: "none", name: "보드 없음", count: (refs ?? []).filter((r) => !r.boardId).length },
          ...boards,
        ].map((b) => (
          <button
            key={b.id}
            onClick={() => setBoard(b.id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${board === b.id ? "border-orange-500 bg-orange-50 font-semibold text-orange-700" : "border-stone-200 bg-white text-stone-600"}`}
          >
            {b.name} <span className="text-stone-400">{b.count}</span>
          </button>
        ))}
        <button onClick={newBoard} className="shrink-0 rounded-full border border-dashed border-stone-300 px-4 py-1.5 text-sm text-stone-500">
          ＋ 보드
        </button>
      </div>
      {boards.some((b) => b.id === board) && (
        <div className="mt-2 flex gap-2 text-xs">
          <button className="text-stone-500 underline" onClick={renameCurrent}>이름 바꾸기</button>
          <button className="text-red-500 underline" onClick={deleteCurrent}>보드 지우기</button>
        </div>
      )}

      {/* 검색·후킹 필터 */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="제목·메모·태그·채널 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        {hooks.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="self-center text-xs text-stone-400">제목 유형</span>
            {hooks.map(([h, n]) => (
              <button
                key={h}
                onClick={() => setHook(hook === h ? "" : h)}
                className={`rounded-full px-2.5 py-1 text-xs ${hook === h ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}
              >
                {h} {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {refs === null && <p className="mt-10 text-center text-stone-400">불러오는 중…</p>}

      {refs !== null && total === 0 && (
        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-10 text-center">
          <p className="text-lg font-semibold">아직 저장한 레퍼가 없어요</p>
          <p className="mt-2 text-sm text-stone-500">
            영상 찾기에서 내 주제를 검색하고, 성과도가 높은 영상을 <b>＋ 레퍼 저장</b> 하세요.
            <br />
            하루 3개면 한 달에 90개, 감이 생기기 시작하는 양입니다.
          </p>
          <Link href="/bibl" className="mt-5 inline-block rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white">
            영상 찾으러 가기
          </Link>
        </div>
      )}

      {total > 0 && shown.length === 0 && <p className="mt-10 text-center text-stone-400">조건에 맞는 레퍼가 없습니다.</p>}

      {view === "mood" ? (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((r) => (
            <Link key={r.id} href={`/bibl/ref/${r.id}`} className="group relative block aspect-video overflow-hidden rounded-lg bg-stone-200">
              {r.video.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.video.thumbnail} alt={r.video.title} className="h-full w-full object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
              )}
              <span className="absolute inset-x-0 bottom-0 translate-y-full bg-black/75 p-2 text-xs text-white transition group-hover:translate-y-0">
                {r.video.title}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <Link key={r.id} href={`/bibl/ref/${r.id}`} className="flex flex-col rounded-2xl border border-stone-200 bg-white p-3 hover:border-orange-300">
              <div className="aspect-video overflow-hidden rounded-lg bg-stone-200">
                {r.video.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.video.thumbnail} alt="" className="h-full w-full object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium leading-5">{r.video.title}</p>
              <p className="mt-1 text-xs text-stone-500">
                {r.video.channelTitle} · 조회수 {fmtCount(r.video.views)} · 구독자의 {ratio(r.video.performanceRatio)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.boardName && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">{r.boardName}</span>}
                {r.analysis?.title.hooks.map((h) => (
                  <span key={h} className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] text-orange-700">{h}</span>
                ))}
                {r.tags.map((t) => (
                  <span key={t} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">#{t}</span>
                ))}
              </div>
              <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${r.note ? "bg-amber-50 text-stone-700" : "bg-stone-50 text-stone-400"}`}>
                {r.note || "배운 점을 아직 안 적었어요 — 눌러서 한 줄 남기기"}
              </p>
            </Link>
          ))}
        </div>
      )}

      {keyPath && (
        <div className="mt-10 rounded-2xl border border-stone-200 bg-white p-4 text-sm text-stone-600">
          <p className="font-semibold text-stone-800">휴대폰에서도 이 보관함 열기</p>
          <p className="mt-1">
            BIBL은 회원가입 없이 이 브라우저에 보관함을 연결해 둡니다. 다른 기기에서 열려면 열쇠 링크를 복사해 그 기기에서 여세요.
            링크를 아는 사람은 누구나 이 보관함을 볼 수 있으니 혼자만 간직하세요.
          </p>
          <button onClick={copyKey} className="mt-3 rounded-lg bg-stone-900 px-4 py-2 font-semibold text-white">
            {copied ? "복사했어요 ✓" : "열쇠 링크 복사"}
          </button>
        </div>
      )}
    </div>
  );
}
