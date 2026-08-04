"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import StepNav from "@/components/StepNav";
import { EvidenceRow, QueryRow, QueryType } from "@/lib/types";

const TYPE_LABEL: Record<QueryType, string> = {
  direct: "직접 검색",
  recommend: "범주형 추천",
  explain: "설명 검증",
  compare: "비교",
  situational: "지역·상황",
};

const ENGINES = ["ChatGPT", "Perplexity", "Gemini", "Copilot", "Naver AI 검색", "Claude", "기타"];

const MENTION_LABEL: Record<string, string> = {
  recommended_candidate: "추천 포함",
  simple_mention: "단순 언급",
  not_found: "미노출",
  collection_failed: "수집 실패",
};

const MENTION_STYLE: Record<string, string> = {
  recommended_candidate: "bg-emerald-100 text-emerald-700",
  simple_mention: "bg-amber-100 text-amber-700",
  not_found: "bg-slate-200 text-slate-600",
  collection_failed: "bg-red-100 text-red-700",
};

function QueryEvidenceCard({
  projectId,
  query,
  evidence,
  onChange,
}: {
  projectId: string;
  query: QueryRow;
  evidence: EvidenceRow[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [engine, setEngine] = useState(ENGINES[0]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [warn, setWarn] = useState("");
  const [copied, setCopied] = useState(false);

  function copyQuestion() {
    navigator.clipboard.writeText(query.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function submit(status?: "collection_failed") {
    if (!status && !text.trim()) return;
    setSubmitting(true);
    setWarn("");
    try {
      const res = await fetch(`/api/projects/${projectId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query_id: query.id, engine_label: engine, response_text: text, status }),
      });
      const data = await res.json();
      if (data.warning) setWarn(data.warning);
      setText("");
      setOpen(false);
      onChange();
    } finally {
      setSubmitting(false);
    }
  }

  async function removeEvidence(eid: string) {
    await fetch(`/api/projects/${projectId}/evidence/${eid}`, { method: "DELETE" });
    onChange();
  }

  return (
    <div className="card p-5 mb-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          {query.sub_category && <span className="badge bg-slate-200 text-slate-600 mr-2">{query.sub_category}</span>}
          <span className="text-sm font-medium">{query.text}</span>
        </div>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost shrink-0">
          {open ? "취소" : "+ 답변 추가"}
        </button>
      </div>

      {evidence.length > 0 && (
        <ul className="space-y-1.5 mb-2">
          {evidence.map((e) => (
            <li key={e.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-1.5">
              <span className="flex items-center gap-2">
                <span className="font-medium text-slate-600">{e.engine_label}</span>
                {e.judged_at ? (
                  <span className={`badge ${MENTION_STYLE[e.mention_type || "not_found"]}`}>{MENTION_LABEL[e.mention_type || "not_found"]}</span>
                ) : e.status === "collection_failed" ? (
                  <span className="badge bg-red-100 text-red-700">수집 실패</span>
                ) : (
                  <span className="badge bg-slate-100 text-slate-400">판정 중...</span>
                )}
              </span>
              <button onClick={() => removeEvidence(e.id)} className="text-slate-400 hover:text-red-500">
                삭제
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-2 space-y-3">
          <ol className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 space-y-1.5 list-decimal list-inside">
            <li>
              아래 <span className="font-semibold text-slate-700">"질문 복사"</span> 버튼으로 이 질문을 복사
            </li>
            <li>ChatGPT·Perplexity 등 AI 서비스에 붙여넣고 직접 물어보기</li>
            <li>거기서 받은 답변 전문을 복사해서 아래 입력창에 붙여넣고 제출</li>
          </ol>
          <div className="flex gap-2">
            <select className="input w-40" value={engine} onChange={(e) => setEngine(e.target.value)}>
              {ENGINES.map((en) => (
                <option key={en} value={en}>
                  {en}
                </option>
              ))}
            </select>
            <button type="button" onClick={copyQuestion} className="btn-secondary text-xs !px-3 shrink-0">
              {copied ? "복사됨" : "질문 복사"}
            </button>
          </div>
          <textarea
            className="input min-h-[100px]"
            placeholder="여기에 AI가 답한 내용을 그대로 붙여넣으세요 (질문이 아니라 답변입니다)"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => submit()} disabled={submitting || !text.trim()} className="btn-primary text-xs !px-4 !py-2">
              {submitting ? "판정 중..." : "제출 및 판정"}
            </button>
            <button onClick={() => submit("collection_failed")} disabled={submitting} className="btn-secondary text-xs !px-4 !py-2">
              수집 실패로 기록
            </button>
          </div>
          {warn && <p className="text-xs text-amber-600">{warn}</p>}
        </div>
      )}
    </div>
  );
}

export default function EvidencePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [filling, setFilling] = useState(false);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<QueryType | "all">("all");

  // Guards against out-of-order responses: React StrictMode (dev) double-invokes
  // this effect, and onChange callbacks can also trigger overlapping calls. Only
  // the response to the most recently issued request is applied.
  const loadSeq = useRef(0);

  async function load() {
    const seq = ++loadSeq.current;
    const res = await fetch(`/api/projects/${params.id}`);
    const data = await res.json();
    if (seq !== loadSeq.current) return;
    setQueries(data.queries);
    setEvidence(data.evidence);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const judgedQueryIds = new Set(evidence.filter((e) => e.judged_at || e.status === "collection_failed").map((e) => e.query_id));
  const progress = queries.length ? Math.round((judgedQueryIds.size / queries.length) * 100) : 0;

  const visibleQueries = filterType === "all" ? queries : queries.filter((q) => q.type === filterType);

  async function runAnalysis() {
    setAnalyzing(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${params.id}/analyze`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      router.push(`/projects/${params.id}/report`);
    } catch (e: any) {
      setError(e.message);
      setAnalyzing(false);
    }
  }

  // 시연·체험용: 모든 질문에 샘플 답변을 채운 뒤 곧바로 분석까지 실행한다.
  async function fillSampleAndAnalyze() {
    setFilling(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${params.id}/evidence/sample`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "샘플 채우기 실패");
      const ares = await fetch(`/api/projects/${params.id}/analyze`, { method: "POST" });
      const adata = await ares.json();
      if (!ares.ok) throw new Error(adata.error || "분석 실패");
      router.push(`/projects/${params.id}/report`);
    } catch (e: any) {
      setError(e.message);
      setFilling(false);
    }
  }

  if (loading) return <p className="text-slate-400 text-sm">불러오는 중...</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <StepNav current="evidence" />

      <div className="card p-4 mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">증거 수집 진행률: {judgedQueryIds.size} / {queries.length}개 질문</p>
          <div className="w-64 h-2 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button onClick={runAnalysis} disabled={analyzing || filling || judgedQueryIds.size === 0} className="btn-primary">
            {analyzing ? "분석 중..." : "분석 실행 →"}
          </button>
          {judgedQueryIds.size === 0 && (
            <>
              <span className="text-xs text-slate-400">답변을 직접 넣거나, 아래 버튼으로 체험해보세요</span>
              <button onClick={fillSampleAndAnalyze} disabled={filling} className="btn-secondary text-xs">
                {filling ? "샘플 채우는 중..." : "⚡ 샘플 답변으로 바로 체험하기"}
              </button>
            </>
          )}
        </div>
      </div>
      {judgedQueryIds.size === 0 && (
        <p className="text-xs text-slate-400 mb-3 -mt-2">
          <span className="font-semibold text-slate-500">"샘플 답변으로 바로 체험하기"</span>는 예시 데이터로 16개 질문을 즉시 채우고 분석까지 실행합니다. 결과 리포트가 어떻게 나오는지 시연·확인할 때 쓰세요. 실제 진단은 각 질문에 진짜 AI 답변을 붙여넣어야 정확합니다.
        </p>
      )}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <p className="text-xs text-slate-400 mb-4">
        각 질문 카드의 <span className="font-semibold">"+ 답변 추가"</span>를 눌러 펼친 뒤, 질문을 복사해 ChatGPT/Perplexity/Gemini 등에 직접 물어보고 받은 답변을 붙여넣어 제출하세요. 최소 1개 이상 제출하면 분석할 수 있지만, 신뢰도 배지를 위해 질문 8개 이상·엔진 2개 이상을 권장합니다.
      </p>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFilterType("all")} className={`btn-ghost ${filterType === "all" ? "bg-slate-100" : ""}`}>
          전체
        </button>
        {(Object.keys(TYPE_LABEL) as QueryType[]).map((t) => (
          <button key={t} onClick={() => setFilterType(t)} className={`btn-ghost ${filterType === t ? "bg-slate-100" : ""}`}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {visibleQueries.map((q) => (
        <QueryEvidenceCard key={q.id} projectId={params.id} query={q} evidence={evidence.filter((e) => e.query_id === q.id)} onChange={load} />
      ))}
    </div>
  );
}
