import { isMockMode } from "./openai";
import { EvidenceRow, Project, QueryRow, ReportJSON, ReportRow } from "./types";

/**
 * 인쇄용 리포트 HTML.
 *
 * 화면 리포트를 그대로 캡처하지 않고 별도로 생성한다:
 * - 버튼·체크박스·근거 보기 같은 조작 UI가 문서에 섞이지 않는다
 * - 페이지 나눔을 의도한 위치에 둘 수 있다
 * - 로그인 쿠키 없이 서버에서 바로 렌더링할 수 있다
 */

const STATUS_LABEL: Record<string, string> = {
  good: "좋음",
  meh: "아쉬움",
  needs_work: "보완 필요",
  risk: "위험",
  unknown: "확인 불가",
};

const STATUS_COLOR: Record<string, string> = {
  good: "#059669",
  meh: "#d97706",
  needs_work: "#ea580c",
  risk: "#dc2626",
  unknown: "#64748b",
};

const GRADE_COLOR: Record<string, string> = {
  A: "#059669",
  B: "#65a30d",
  C: "#d97706",
  D: "#ea580c",
  E: "#dc2626",
};

const TRUST_LABEL: Record<string, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const MENTION_LABEL: Record<string, string> = {
  recommended_candidate: "추천 포함",
  simple_mention: "단순 언급",
  not_found: "미노출",
  collection_failed: "수집 실패",
};

/** HTML 특수문자를 이스케이프한다. 사용자 입력이 그대로 들어가므로 반드시 거친다. */
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface ReportHtmlInput {
  project: Project;
  report: ReportRow;
  data: ReportJSON;
  queries: QueryRow[];
  evidence: EvidenceRow[];
  /** 에이전시 화이트라벨용. 없으면 기본 문구를 쓴다. */
  brandingNote?: string;
}

export function buildReportHtml(input: ReportHtmlInput): string {
  const { project, report, data: r, queries, evidence } = input;
  const date = new Date(report.created_at + "Z").toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const queryById = new Map(queries.map((q) => [q.id, q]));
  // 키가 없어 샘플 로직으로 만든 리포트인지. 표지에 경고를 띄우는 근거가 된다.
  const isMock = isMockMode();

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><title>${esc(project.brand_name)} AI 추천도 리포트</title>
<!--
  한글 웹폰트를 렌더링 시점에 불러온다.
  배포 리눅스 이미지에는 한글 폰트가 없어 그대로 두면 전부 두부(□)가 된다.
  Nix 폰트 패키지는 스냅샷마다 이름이 달라 빌드를 깨뜨리므로 웹폰트로 처리한다.
  로컬(macOS)에서는 아래 시스템 폰트가 먼저 잡히므로 영향이 없다.
-->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Apple SD Gothic Neo", "Pretendard", "Noto Sans KR",
                 "Noto Sans CJK KR", "Malgun Gothic", sans-serif;
    color: #0f172a; margin: 0; font-size: 10.5pt; line-height: 1.65;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  h1,h2,h3 { margin: 0; font-weight: 700; }
  .muted { color: #64748b; }
  .xs { font-size: 8.5pt; }
  .sm { font-size: 9.5pt; }

  .cover { padding: 40mm 0 0; page-break-after: always; }
  .cover .eyebrow { font-size: 10pt; letter-spacing: .18em; color: #6366f1; font-weight: 700; }
  .cover h1 { font-size: 30pt; margin: 10px 0 6px; letter-spacing: -.02em; }
  .cover .sub { font-size: 12pt; color: #475569; }
  .cover .meta { margin-top: 30mm; border-top: 1px solid #e2e8f0; padding-top: 14px; }
  .cover .meta div { margin-bottom: 5px; }

  section { page-break-inside: avoid; margin-bottom: 22px; }
  .sec-title {
    font-size: 13pt; border-bottom: 2px solid #0f172a;
    padding-bottom: 6px; margin-bottom: 14px;
  }

  .oneline {
    font-size: 13pt; line-height: 1.6; background: #f8fafc;
    border-left: 4px solid #6366f1; padding: 16px 18px; margin-bottom: 18px;
  }

  .score-row { display: flex; align-items: flex-end; gap: 22px; margin-bottom: 10px; }
  .score-num { font-size: 42pt; font-weight: 800; line-height: 1; }
  .grade { font-size: 15pt; font-weight: 700; }

  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 7px 9px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f8fafc; font-size: 9pt; color: #475569; font-weight: 700; }

  .bar { height: 7px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 5px 0; }
  .bar > i { display: block; height: 100%; background: #6366f1; }

  .chip {
    display: inline-block; font-size: 8pt; padding: 2px 7px; border-radius: 4px;
    background: #f1f5f9; color: #475569; margin: 0 4px 4px 0;
  }
  .badge {
    display: inline-block; font-size: 8pt; font-weight: 700; color: #fff;
    padding: 2px 8px; border-radius: 999px;
  }

  .finding { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid #f1f5f9; }
  .action { border: 1px solid #e2e8f0; border-radius: 8px; padding: 13px 15px; margin-bottom: 11px; page-break-inside: avoid; }
  .action .no {
    display: inline-grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
    background: #6366f1; color: #fff; font-size: 8.5pt; font-weight: 700; margin-right: 7px;
  }
  .copybox { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin: 8px 0; font-style: italic; color: #334155; }
  .steps { margin: 8px 0 0 18px; padding: 0; }
  .steps li { margin-bottom: 3px; }

  .asset { background: #f8fafc; border-radius: 6px; padding: 11px 13px; margin-bottom: 8px; page-break-inside: avoid; }
  .asset .label { font-size: 8pt; font-weight: 700; color: #6366f1; letter-spacing: .05em; margin-bottom: 4px; }

  .pagebreak { page-break-before: always; }
  footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
  /* 데모(목업) 모드 경고. 실제 AI 판정이 아닌 결과가 고객에게 전달되는 사고를 막는다. */
  .demo-warn { margin: 18px 0 0; padding: 12px 14px; border: 2px solid #dc2626;
    border-radius: 6px; background: #fef2f2; color: #991b1b; }
  .demo-warn b { font-size: 12pt; }
  .demo-warn p { margin: 6px 0 0; font-size: 9pt; line-height: 1.6; color: #7f1d1d; }
</style></head><body>

<!-- 표지 -->
<div class="cover">
  <div class="eyebrow">AI 추천도 진단 리포트</div>
  <h1>${esc(project.brand_name)}</h1>
  <div class="sub">${esc(project.entity_type)} · ${esc(project.region)}</div>
  <div class="meta sm muted">
    <div><b>진단 회차</b> &nbsp; ${report.run_number}차</div>
    <div><b>진단일</b> &nbsp; ${esc(date)}</div>
    <div><b>표본</b> &nbsp; 질문 ${r.score.sample_size}개 · 엔진 ${r.score.engine_count}종 · 수집 실패율 ${r.score.failure_rate}%</div>
    <div style="margin-top:14px; line-height:1.7">
      본 리포트는 위 시점·질문·모델에서 관측한 결과입니다.<br>
      AI 추천이나 검색 순위를 보장하지 않습니다.
    </div>
  </div>
  ${
    isMock
      ? `<div class="demo-warn">
    <b>⚠ 데모(샘플) 리포트 — 실제 AI 진단 결과가 아닙니다</b>
    <p>LLM API 키가 설정되지 않아 샘플 로직으로 생성된 문서입니다. 점수·판정·근거는 실제 측정값이
    아니므로 고객에게 전달하거나 의사결정에 사용하지 마세요.<br>
    실제 진단을 하려면 <code>.env.local</code>에 OPENAI_API_KEY 또는 ANTHROPIC_API_KEY를 넣고
    서버를 다시 시작한 뒤 새로 진단하세요.</p>
  </div>`
      : ""
  }
</div>

<!-- 요약 -->
<section>
  <h2 class="sec-title">한 줄 진단</h2>
  <div class="oneline">${esc(r.summary.one_line)}</div>

  <div class="score-row">
    <div>
      <span class="score-num" style="color:${GRADE_COLOR[r.score.grade] ?? "#0f172a"}">${r.score.total}</span>
      <span class="muted"> / 100</span>
    </div>
    <div>
      <div class="grade" style="color:${GRADE_COLOR[r.score.grade] ?? "#0f172a"}">${esc(r.score.grade)}등급</div>
      <div class="sm muted">${esc(r.score.grade_label)}</div>
    </div>
    <div style="margin-left:auto; text-align:right">
      <div class="sm"><b>${esc(r.score.trust_label)}</b></div>
      <div class="xs muted">신뢰도 ${esc(TRUST_LABEL[r.score.trust_badge] ?? r.score.trust_badge)}</div>
    </div>
  </div>
</section>

<!-- 핵심 발견 -->
<section>
  <h2 class="sec-title">핵심 발견</h2>
  ${r.findings
    .map(
      (f) => `<div class="finding">
        <span class="badge" style="background:${STATUS_COLOR[f.status] ?? "#64748b"}">${STATUS_LABEL[f.status] ?? esc(f.status)}</span>
        <div><b>${esc(f.title)}</b><div class="sm muted">${esc(f.detail)}</div></div>
      </div>`
    )
    .join("")}
</section>

<!-- 엔터티 정의 -->
<section>
  <h2 class="sec-title">진단 대상 정의</h2>
  <table>
    <tr><th style="width:26%">대표 키워드</th><td>${esc(r.entity.keywords.join(", ")) || "-"}</td></tr>
    <tr><th>목표 청중</th><td>${esc(r.entity.audiences.join(", ")) || "-"}</td></tr>
    <tr><th>공식 자산</th><td>${
      r.entity.official_assets.length
        ? r.entity.official_assets.map((u) => esc(u)).join("<br>")
        : "등록된 채널 없음"
    }</td></tr>
  </table>
</section>

<!-- 5축 -->
<section class="pagebreak">
  <h2 class="sec-title">5축 진단</h2>
  ${r.axes
    .map(
      (a) => `<div style="margin-bottom:15px; page-break-inside:avoid">
        <div style="display:flex; justify-content:space-between">
          <b>${esc(a.label)}</b><b>${a.raw} / ${a.max}</b>
        </div>
        <div class="bar"><i style="width:${Math.max(0, Math.min(100, (a.raw / a.max) * 100))}%"></i></div>
        <div class="sm muted">${esc(a.judgment)}</div>
        <div style="margin-top:5px">${a.breakdown
          .map((b) => `<span class="chip">${esc(b.label)} ${b.value}/${b.max}</span>`)
          .join("")}</div>
      </div>`
    )
    .join("")}
</section>

<section>
  <h2 class="sec-title">왜 추천에서 약한가</h2>
  <p style="margin:0">${esc(r.why_weak)}</p>
</section>

<!-- 액션 -->
<section class="pagebreak">
  <h2 class="sec-title">우선 실행 액션</h2>
  ${r.actions
    .map(
      (a) => `<div class="action">
        <div><span class="no">${a.priority}</span><b>${esc(a.title)}</b>
          <span class="xs muted" style="float:right">${esc(a.channel)}</span></div>
        <div class="sm muted" style="margin-top:5px">${esc(a.rationale)}</div>
        <div class="copybox sm">${esc(a.copy)}</div>
        ${
          a.steps?.length
            ? `<ol class="steps sm">${a.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>`
            : ""
        }
      </div>`
    )
    .join("")}
</section>

<!-- 문안 -->
<section class="pagebreak">
  <h2 class="sec-title">채널에 바로 쓰는 문안</h2>
  ${[
    ["1문장 정의", r.copy_assets.one_sentence],
    ["3문장 소개", r.copy_assets.three_sentence],
    ["메타 설명", r.copy_assets.meta_description],
    ["공통 프로필", r.copy_assets.common_profile],
  ]
    .map(
      ([label, value]) =>
        `<div class="asset"><div class="label">${esc(label)}</div><div>${esc(value)}</div></div>`
    )
    .join("")}
  ${
    r.copy_assets.faq.length
      ? `<div class="asset"><div class="label">FAQ</div>${r.copy_assets.faq
          .map((f) => `<div style="margin-bottom:8px"><b>Q. ${esc(f.q)}</b><br>A. ${esc(f.a)}</div>`)
          .join("")}</div>`
      : ""
  }
</section>

<!-- 30일 재점검 체크리스트 (PRD F7) -->
${
  r.recheck_checklist?.length
    ? `<section class="pagebreak">
  <h2 class="sec-title">30일 재점검 체크리스트</h2>
  <p class="sm muted" style="margin:0 0 10px">
    위 액션을 실행한 뒤 30일이 지나면 아래 항목을 직접 점검하세요.
    생성형 AI 답변은 매번 흔들리므로 통과 기준은 100% 재현이 아니라 다수결로 잡았습니다.
  </p>
  <table>
    <thead><tr>
      <th style="width:28%">점검 항목</th><th style="width:38%">확인 방법</th><th>통과 기준</th>
    </tr></thead>
    <tbody>
      ${r.recheck_checklist
        .map(
          (c) =>
            `<tr><td><b>${esc(c.item)}</b></td><td class="sm">${esc(c.how)}</td><td class="sm">${esc(
              c.pass_criteria
            )}</td></tr>`
        )
        .join("")}
    </tbody>
  </table>
</section>`
    : ""
}

<!-- 근거 -->
<section class="pagebreak">
  <h2 class="sec-title">근거 부록 — 질문별 관측 결과</h2>
  <table>
    <thead><tr>
      <th style="width:46%">질문</th><th style="width:14%">엔진</th>
      <th style="width:16%">판정</th><th>출처</th>
    </tr></thead>
    <tbody>
      ${evidence
        .map((e) => {
          const q = queryById.get(e.query_id);
          let cites: string[] = [];
          try {
            cites = e.citations ? JSON.parse(e.citations) : [];
          } catch {
            cites = [];
          }
          return `<tr>
            <td class="sm">${esc(q?.text ?? "(삭제된 질문)")}</td>
            <td class="sm">${esc(e.engine_label)}</td>
            <td class="sm">${esc(MENTION_LABEL[e.mention_type ?? ""] ?? "미판정")}</td>
            <td class="xs muted">${
              cites.length
                ? cites.map((c) => esc(c)).join("<br>")
                : e.entity_found === 1
                ? "출처 미표기"
                : "—"
            }</td>
          </tr>`;
        })
        .join("")}
    </tbody>
  </table>
  <p class="xs muted" style="margin-top:8px">
    "출처 미표기"는 브랜드가 언급됐으나 해당 답변이 인용 URL을 제시하지 않은 경우입니다.
    엔진·질문에 따라 인용을 달지 않는 경우가 흔하며, 출처가 없다는 뜻은 아닙니다.
    "—"는 브랜드가 응답에 등장하지 않은 경우입니다.
  </p>
</section>

<footer class="xs muted">
  ${esc(input.brandingNote ?? "AI 추천도 진단으로 생성된 리포트입니다.")}<br>
  ${r.limitations.map((l) => esc(l)).join(" · ")}
</footer>

</body></html>`;
}
