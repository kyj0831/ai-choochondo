"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import StepNav from "@/components/StepNav";
import StatusBadge from "@/components/StatusBadge";
import { EvidenceRow, Project, QueryRow, ReportJSON, ReportRow } from "@/lib/types";

const GRADE_COLOR: Record<string, string> = {
  A: "text-emerald-600",
  B: "text-lime-600",
  C: "text-amber-600",
  D: "text-orange-600",
  E: "text-red-600",
};

const TRUST_LABEL: Record<string, string> = { high: "신뢰도 높음", medium: "신뢰도 보통", low: "신뢰도 낮음" };
const TRUST_STYLE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-red-100 text-red-700",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="btn-ghost bg-slate-100"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}

export default function ReportPage({ params }: { params: { id: string } }) {
  const [project, setProject] = useState<Project | null>(null);
  const [report, setReport] = useState<ReportRow | null>(null);
  const [queries, setQueries] = useState<QueryRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);
  const [reruns, setReruns] = useState<ReportRow[]>([]);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [showEvidenceFor, setShowEvidenceFor] = useState<string[] | null>(null);
  // 액션별 실행 단계 체크 상태. 리포트 회차(report.id) 단위로 localStorage에 보존한다.
  const [doneSteps, setDoneSteps] = useState<Record<string, boolean>>({});

  // Guards against out-of-order responses: React StrictMode (dev) double-invokes
  // the initial effect, and reanalyze() also calls load() — only the response to
  // the most recently issued request is applied.
  const loadSeq = useRef(0);

  async function load() {
    const seq = ++loadSeq.current;
    const res = await fetch(`/api/projects/${params.id}`);
    const data = await res.json();
    const rr = await fetch(`/api/projects/${params.id}/report`).then((r) => r.json());
    if (seq !== loadSeq.current) return;
    setProject(data.project);
    setReport(data.latestReport);
    setQueries(data.queries);
    setEvidence(data.evidence);
    setReruns(rr.reports);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  useEffect(() => {
    if (!report) return;
    try {
      const saved = localStorage.getItem(`report-steps-${report.id}`);
      setDoneSteps(saved ? JSON.parse(saved) : {});
    } catch {
      setDoneSteps({});
    }
  }, [report?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleStep(key: string) {
    if (!report) return;
    setDoneSteps((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(`report-steps-${report.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function reanalyze() {
    setReanalyzing(true);
    await fetch(`/api/projects/${params.id}/analyze`, { method: "POST" });
    await load();
    setReanalyzing(false);
  }

  if (!project) return <p className="text-slate-400 text-sm">불러오는 중...</p>;
  if (!report) return <p className="text-slate-400 text-sm">아직 리포트가 없습니다. 증거 수집 후 분석을 실행하세요.</p>;

  const r: ReportJSON = JSON.parse(report.report_json);
  const prevReport = reruns.find((x) => x.run_number === report.run_number - 1);
  const delta = prevReport ? Math.round((report.score_total - prevReport.score_total) * 10) / 10 : null;

  return (
    <div className="max-w-4xl mx-auto pb-16">
      <StepNav current="report" />

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.brand_name} · AI 추천도 리포트</h1>
          <p className="text-xs text-slate-400 mt-1">
            {report.run_number}차 진단 · {new Date(report.created_at).toLocaleString("ko-KR")}
          </p>
        </div>
        <button onClick={reanalyze} disabled={reanalyzing} className="btn-secondary text-xs">
          {reanalyzing ? "재분석 중..." : "동일 조건 재분석"}
        </button>
      </div>

      {/* 1. 한 줄 진단 + 2. 총점/신뢰도 */}
      <div className="card p-6 mb-5">
        <p className="text-lg leading-relaxed mb-5">{r.summary.one_line}</p>
        <div className="flex items-center gap-8 flex-wrap">
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl font-extrabold ${GRADE_COLOR[r.score.grade]}`}>{r.score.total}</span>
            <span className="text-slate-400 text-sm">/ 100</span>
          </div>
          <div>
            <span className={`text-xl font-bold ${GRADE_COLOR[r.score.grade]}`}>{r.score.grade}등급</span>
            <p className="text-sm text-slate-500">{r.score.grade_label}</p>
          </div>
          {delta !== null && (
            <div className={`text-sm font-semibold ${delta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              전회 대비 {delta >= 0 ? "+" : ""}
              {delta}점
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className={`badge ${TRUST_STYLE[r.score.trust_badge]}`}>{TRUST_LABEL[r.score.trust_badge]}</span>
            <span className="text-xs text-slate-400">{r.score.trust_label}</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          표본 {r.score.sample_size}개 질문 · 엔진 {r.score.engine_count}종 · 수집 실패율 {r.score.failure_rate}% · 관측 시점 기준 지표이며 순위·추천을 보장하지 않습니다.
        </p>
      </div>

      {/* 3. 핵심 발견 */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-4">핵심 발견</h2>
        <ul className="space-y-3">
          {r.findings.map((f, i) => (
            <li key={i} className="flex items-start gap-3">
              <StatusBadge status={f.status} />
              <div className="flex-1">
                <p className="text-sm font-medium">{f.title}</p>
                <p className="text-sm text-slate-500">{f.detail}</p>
              </div>
              {f.evidence_ids?.length > 0 && (
                <button
                  onClick={() => {
                    setShowEvidenceFor(f.evidence_ids);
                    document.getElementById(`evidence-${f.evidence_ids[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="btn-ghost text-brand-600 shrink-0"
                >
                  근거 보기
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* 4. 엔터티 정의 */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-3">엔터티 정의</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-slate-400 text-xs mb-1">대표 키워드</p>
            <p>{r.entity.keywords.join(", ") || "-"}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">목표 청중</p>
            <p>{r.entity.audiences.join(", ") || "-"}</p>
          </div>
          <div>
            <p className="text-slate-400 text-xs mb-1">공식 자산</p>
            <p>{r.entity.official_assets.length}개 등록</p>
          </div>
        </div>
      </div>

      {/* 5. 5축 진단 */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-4">5축 진단</h2>
        <div className="space-y-4">
          {r.axes.map((a) => (
            <div key={a.axis}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{a.label}</span>
                <span className="text-sm font-semibold">
                  {a.raw} / {a.max}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                <div className="h-full bg-brand-500" style={{ width: `${(a.raw / a.max) * 100}%` }} />
              </div>
              <p className="text-xs text-slate-500 mb-1.5">{a.judgment}</p>
              <div className="flex gap-3 flex-wrap">
                {a.breakdown.map((b) => (
                  <span key={b.label} className="text-xs text-slate-400 bg-slate-50 rounded px-2 py-1">
                    {b.label} {b.value}/{b.max}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. 왜 추천에서 약한가 */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-2">왜 추천에서 약한가</h2>
        <p className="text-sm text-slate-600 leading-relaxed">{r.why_weak}</p>
      </div>

      {/* 7. 우선 액션 5개 + 단계별 실행 가이드 */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-1">우선 액션 · 실행 가이드</h2>
        <p className="text-xs text-slate-400 mb-4">
          각 액션의 단계를 순서대로 실행하고 체크하세요. 체크 상태는 이 브라우저에 저장됩니다.
        </p>
        <div className="space-y-3">
          {r.actions.map((a) => {
            const steps = a.steps || [];
            const doneCount = steps.filter((_, i) => doneSteps[`p${a.priority}-${i}`]).length;
            const allDone = steps.length > 0 && doneCount === steps.length;
            return (
              <div
                key={a.priority}
                className={`border rounded-xl p-4 ${allDone ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2">
                    <span className={`badge ${allDone ? "bg-emerald-500" : "bg-brand-500"} text-white`}>
                      {allDone ? "✓" : a.priority}
                    </span>
                    <span className="font-semibold text-sm">{a.title}</span>
                    {steps.length > 0 && (
                      <span className={`text-xs ${allDone ? "text-emerald-600 font-semibold" : "text-slate-400"}`}>
                        {allDone ? "완료" : `${doneCount}/${steps.length} 단계`}
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-slate-400">{a.channel}</span>
                </div>
                <p className="text-sm text-slate-500 mb-2">{a.rationale}</p>
                <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 mb-2">
                  <p className="text-sm text-slate-700 italic flex-1">{a.copy}</p>
                  <CopyButton text={a.copy} />
                </div>
                {steps.length > 0 && (
                  <ol className="space-y-1.5">
                    {steps.map((s, i) => {
                      const key = `p${a.priority}-${i}`;
                      const done = !!doneSteps[key];
                      return (
                        <li key={key}>
                          <label className="flex items-start gap-2 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-slate-50">
                            <input type="checkbox" checked={done} onChange={() => toggleStep(key)} className="mt-0.5 accent-emerald-500" />
                            <span className={`text-sm ${done ? "text-slate-400 line-through" : "text-slate-700"}`}>
                              <span className="font-medium text-slate-400 mr-1">{i + 1}.</span>
                              {s}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. 복붙 문안 */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-4">개선 문안</h2>
        <div className="space-y-3">
          {[
            { label: "1문장 정의", value: r.copy_assets.one_sentence },
            { label: "3문장 소개", value: r.copy_assets.three_sentence },
            { label: "메타 설명", value: r.copy_assets.meta_description },
            { label: "공통 프로필", value: r.copy_assets.common_profile },
          ].map((c) => (
            <div key={c.label} className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-500">{c.label}</span>
                <CopyButton text={c.value} />
              </div>
              <p className="text-sm text-slate-700">{c.value}</p>
            </div>
          ))}
          {r.copy_assets.faq.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-3">
              <span className="text-xs font-semibold text-slate-500 block mb-2">FAQ</span>
              <div className="space-y-2">
                {r.copy_assets.faq.map((f, i) => (
                  <div key={i} className="text-sm">
                    <p className="font-medium">Q. {f.q}</p>
                    <p className="text-slate-600">A. {f.a}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI 프로필 허브 — 진단이 지목한 원인을 직접 해소하는 경로 */}
      <div className="card p-6 mb-5 border-2 border-indigo-200 bg-indigo-50/40">
        <h2 className="font-semibold mb-1">원인을 바로 해소하기 — AI 프로필 허브</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-4">
          위 진단이 지목한 구조적 원인은 <strong>공식 정보가 흩어져 AI가 대표 정체성을 특정하지 못하는 것</strong>입니다.
          허브는 하나의 주소에 정체성·공식 채널·FAQ를 모으고, 구조화 데이터와 llms.txt로 AI가 읽을 수 있는 형태까지
          함께 제공합니다.
        </p>
        <ul className="text-sm text-slate-600 space-y-1.5 mb-4">
          <li>· 공식 채널을 <code className="text-xs bg-white px-1.5 py-0.5 rounded">sameAs</code>로 묶어 같은 주체임을 선언</li>
          <li>· 이번 진단에서 <strong>후보에 오르지 못한 질의</strong>를 FAQ 질문으로 바로 가져옴</li>
          <li>· 발행 후 어떤 AI 사업자의 크롤러가 읽어갔는지 기록</li>
        </ul>
        <Link href={`/projects/${params.id}/hub`} className="btn-primary !bg-indigo-600 hover:!bg-indigo-700">
          AI 프로필 허브 만들기 →
        </Link>
      </div>

      {/* 다음 단계 CTA */}
      <div className="card p-6 mb-5 border-2 border-brand-200 bg-brand-50/40">
        <h2 className="font-semibold mb-1">실행을 마쳤다면 — 다음 단계</h2>
        <p className="text-xs text-slate-500 mb-4">
          채널 수정이 AI 답변에 반영되기까지 보통 1~4주가 걸립니다. 아래 순서로 개선 효과를 확인하세요.
        </p>
        <ol className="space-y-2 text-sm text-slate-700 mb-4">
          <li className="flex gap-2">
            <span className="badge bg-brand-500 text-white shrink-0">1</span>
            위 우선 액션의 단계를 실행하고 체크리스트를 완료하세요
          </li>
          <li className="flex gap-2">
            <span className="badge bg-brand-500 text-white shrink-0">2</span>
            1~4주 뒤, 증거 수집 화면에서 같은 질문을 AI에 다시 물어보고 새 답변을 제출하세요
          </li>
          <li className="flex gap-2">
            <span className="badge bg-brand-500 text-white shrink-0">3</span>
            분석을 다시 실행하면 이번 리포트 대비 점수 변화가 자동으로 표시됩니다
          </li>
        </ol>
        <div className="flex gap-2">
          <Link href={`/projects/${params.id}/evidence`} className="btn-primary text-sm">
            새 증거 수집하러 가기 →
          </Link>
          <button onClick={reanalyze} disabled={reanalyzing} className="btn-secondary text-sm">
            {reanalyzing ? "재분석 중..." : "현재 증거로 재분석"}
          </button>
        </div>
      </div>

      {/* 9. 근거 부록 */}
      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-4">근거 부록</h2>
        <ul className="space-y-2">
          {evidence
            .filter((e) => e.judged_at)
            .map((e) => {
              const q = queries.find((qq) => qq.id === e.query_id);
              return (
                <li
                  key={e.id}
                  id={`evidence-${e.id}`}
                  className={`text-sm border rounded-lg p-3 ${
                    showEvidenceFor?.includes(e.id) ? "border-brand-400 bg-brand-50" : "border-slate-100"
                  }`}
                >
                  <p className="font-medium">{q?.text}</p>
                  <p className="text-xs text-slate-400 mb-1">
                    {e.engine_label} · {MENTION_LABEL(e.mention_type)} · 신뢰도 {Math.round((e.confidence || 0) * 100)}%
                  </p>
                  <p className="text-slate-600 whitespace-pre-wrap line-clamp-3">{e.response_text}</p>
                </li>
              );
            })}
        </ul>
      </div>

      {/* 10. 한계 고지 */}
      <div className="text-xs text-slate-400 border-t border-slate-200 pt-4">
        {r.limitations.map((l, i) => (
          <p key={i}>· {l}</p>
        ))}
      </div>
    </div>
  );
}

function MENTION_LABEL(m: string | null): string {
  const map: Record<string, string> = {
    recommended_candidate: "추천 포함",
    simple_mention: "단순 언급",
    not_found: "미노출",
    collection_failed: "수집 실패",
  };
  return map[m || ""] || "-";
}
