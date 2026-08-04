"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import StepNav from "@/components/StepNav";
import { QueryRow, QueryType } from "@/lib/types";

const TYPE_LABEL: Record<QueryType, string> = {
  direct: "직접 검색",
  recommend: "범주형 추천",
  explain: "설명 검증",
  compare: "비교",
  situational: "지역·상황",
};

const TYPE_ORDER: QueryType[] = ["direct", "recommend", "situational", "compare", "explain"];

export default function QueriesPage({ params }: { params: { id: string } }) {
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState<QueryType>("recommend");

  async function generate() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${params.id}/queries`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "질문 생성 실패");
      setQueries(data.queries);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  const autoGenerateStarted = useRef(false);

  useEffect(() => {
    let ignore = false;

    async function init() {
      const res = await fetch(`/api/projects/${params.id}/queries`);
      const data = await res.json();
      if (ignore) return;
      setQueries(data.queries);
      setLoading(false);
      if (data.queries.length === 0 && !autoGenerateStarted.current) {
        autoGenerateStarted.current = true;
        generate();
      }
    }
    init();

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function addQuery() {
    if (!newText.trim()) return;
    const res = await fetch(`/api/projects/${params.id}/queries`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: newText.trim(), type: newType, importance: 2 }),
    });
    const data = await res.json();
    setQueries(data.queries);
    setNewText("");
  }

  async function removeQuery(qid: string) {
    await fetch(`/api/projects/${params.id}/queries/${qid}`, { method: "DELETE" });
    setQueries((prev) => prev.filter((q) => q.id !== qid));
  }

  const grouped = TYPE_ORDER.map((t) => ({ type: t, items: queries.filter((q) => q.type === t) })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto">
      <StepNav current="queries" />
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">질문 세트 편집</h1>
        <button onClick={generate} disabled={generating} className="btn-secondary text-xs">
          {generating ? "재생성 중..." : "질문 다시 생성"}
        </button>
      </div>
      <p className="text-sm text-slate-500 mb-6">직접 검색, 범주형 추천, 설명 검증 질문을 검토하고 추가·삭제할 수 있습니다.</p>

      {loading && <p className="text-slate-400 text-sm">불러오는 중...</p>}
      {generating && queries.length === 0 && (
        <div className="card p-10 text-center text-slate-400 text-sm">AI가 질문 세트를 생성하고 있습니다...</div>
      )}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {grouped.map((g) => (
        <div key={g.type} className="card p-5 mb-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            {TYPE_LABEL[g.type]}
            <span className="text-xs font-normal text-slate-400">{g.items.length}개</span>
          </h2>
          <ul className="space-y-2">
            {g.items.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                <span>
                  {q.sub_category && <span className="badge bg-slate-200 text-slate-600 mr-2">{q.sub_category}</span>}
                  {q.text}
                </span>
                <button onClick={() => removeQuery(q.id)} className="text-slate-400 hover:text-red-500 text-xs shrink-0">
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {queries.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-semibold mb-3">질문 추가</h2>
          <div className="flex gap-2">
            <select className="input w-32" value={newType} onChange={(e) => setNewType(e.target.value as QueryType)}>
              {TYPE_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
            <input className="input" placeholder="질문 내용을 입력하세요" value={newText} onChange={(e) => setNewText(e.target.value)} />
            <button onClick={addQuery} className="btn-secondary shrink-0">
              추가
            </button>
          </div>
        </div>
      )}

      {queries.length > 0 && (
        <div className="flex justify-end">
          <Link href={`/projects/${params.id}/evidence`} className="btn-primary">
            다음: 증거 수집 →
          </Link>
        </div>
      )}
    </div>
  );
}
