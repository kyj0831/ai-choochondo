import { callJSON, isMockMode } from "./openai";
import { AxisScore, EntityType, EvidenceRow, MentionType, QueryRow, QueryType, ReportJSON, SourceType } from "./types";

const FORBIDDEN_NOTICE = `금지 표현: "AI 검색 1위", "무조건 추천", "노출 보장", "AI 알고리즘 해킹" 등 검증 불가능한 확정 표현을 쓰지 마라.
경쟁사를 비방하거나 점수를 사실·평판으로 단정하지 마라. 출처 없이 AI를 의인화하지 마라(예: "AI가 싫어한다").
스팸·가짜 리뷰·링크 조작 등 비정상 최적화를 제안하지 마라. 사용자가 제공하지 않은 경력·실적·고객사를 만들어내지 마라.`;

// ---------------- 1. Query generation ----------------

export interface GenerateQueriesInput {
  brandName: string;
  entityType: EntityType;
  region: string;
  language: string;
  categories: string[];
  audiences: string[];
}

export interface GeneratedQuery {
  text: string;
  type: QueryType;
  sub_category: string;
  importance: number;
}

export async function generateQueries(input: GenerateQueriesInput): Promise<GeneratedQuery[]> {
  if (isMockMode()) return mockQueries(input);

  const system = `당신은 AI 검색 가시성 진단을 위한 질의 설계자다.
생성한 질문은 실제로 ChatGPT·Perplexity 같은 AI에 입력되고, 그 답변에 이 브랜드가
등장하는지로 점수를 매긴다. 따라서 모든 질문은 "판정 가능"해야 한다.

## 절대 규칙 1 — 개수는 반드시 채운다
아래 타입별 개수를 **정확히** 지켜라. 총 16개다.
품질 기준에 걸려 질문을 버렸다면 **반드시 다른 각도로 새로 만들어 채워라.**
개수를 줄이는 것은 허용되지 않는다. 표본이 부족하면 진단 신뢰도가 떨어진다.

## 절대 규칙 2 — 판정 가능성
recommend / situational / compare 질문은 **AI가 답할 때 특정 업체·사람·가게의 고유명사를
후보로 나열하게 되는 질문**이어야 한다.
질문을 만든 뒤 스스로 물어라: "AI가 이 질문에 답하면서 특정 업체 이름을 나열할까?"
아니라면 그 질문은 버리고 **같은 개수만큼 다른 각도로 새로 만들어라.**
일반론이 답으로 나오는 질문은 브랜드가 등장할 수 없어 점수를 부당하게 깎는다.

버려야 할 질문(일반론이 답이 되는 것):
- "OO를 선택할 때 고려사항은 무엇인가요?"  ← 조언이 답
- "효과적인 OO 전략은 무엇인가요?"          ← 방법론이 답
- "OO를 찾을 때 어떤 질문을 해야 하나요?"   ← 체크리스트가 답
- "OO의 가격대는 어떻게 되나요?"            ← 시세 정보가 답
- "OO의 주요 역할은 무엇인가요?"            ← 정의가 답

좋은 질문(고유명사가 답에 나열되는 것):
- "서울에서 OO 잘하는 곳 추천해줘"
- "OO가 필요한데 어디에 맡기면 좋을까?"
- "OO 분야에서 유명한 사람 알려줘"
- "국내 OO 업체 중 어디가 괜찮아?"

## 타입별 지시
- "direct" — 정확히 3개. **브랜드명 필수 포함.** 브랜드 자체를 묻는 질문
  (예: "OO는 어떤 곳이야?", "OO에 대해 알려줘", "OO 어디에 있어?")
- "recommend" — 6개. **브랜드명 절대 미포함.** 카테고리·지역·대상 기반 추천 요청.
- "situational" — 4개. **브랜드명 절대 미포함.**
  구체적인 상황·문제를 제시하고 "그래서 어디에/누구에게 맡기면 좋겠냐"고 묻는 형태.
  상황만 설명하고 끝내지 말고 반드시 추천을 요구하라.
  (예: "시리즈A 앞두고 언론 노출을 늘려야 하는데 어디에 맡기면 좋을까?")
- "explain" — 3개. **브랜드명 필수 포함.**
  AI가 이 브랜드를 정확히 설명하는지 검증한다. 업계 일반 질문이 아니라
  이 브랜드의 업종·지역·서비스·실적·최근 활동을 직접 묻는 질문이어야 한다.
  (예: "OO의 주요 서비스는 뭐야?", "OO는 어디에서 활동해?", "OO의 대표 실적은?")

## 다양성
- 같은 카테고리 표현을 여러 질문에 반복하지 마라. 질의군이 겹치면 커버리지 점수가 왜곡된다.
- recommend 6개는 서로 다른 각도여야 한다(지역 / 대상 / 목적 / 규모 / 전문성 / 평판 등).
- 어투도 섞어라(존댓말·반말·짧은 검색어형).

sub_category는 질문의 의도 그룹을 나타내는 짧은 한글 라벨
(예: "지역 기반 추천", "대상 기반 추천", "전문성 기반 추천", "설명 검증").

## 출력 전 자체 검증
JSON을 내보내기 전에 반드시 개수를 세어 확인하라:
direct 3개 + recommend 6개 + situational 4개 + explain 3개 = 총 16개.
하나라도 모자라면 그 타입의 질문을 더 만들어 채운 뒤 출력하라.

JSON만 출력하라. 스키마: {"queries": [{"text": string, "type": "direct"|"recommend"|"explain"|"compare"|"situational", "sub_category": string, "importance": 1|2|3}]}`;

  const user = `entity_name: ${input.brandName}
entity_type: ${input.entityType}
region/language: ${input.region} / ${input.language}
categories: ${input.categories.join(", ") || "(미지정)"}
audiences: ${input.audiences.join(", ") || "(미지정)"}`;

  const result = await callJSON<{ queries: GeneratedQuery[] }>(system, user);
  return ensureQueryCounts(result.queries ?? [], input);
}

/** 타입별 목표 개수. 표본이 15개 이상이어야 신뢰도 배지가 "높음"이 된다. */
const TARGET_COUNTS: Partial<Record<QueryType, number>> = {
  direct: 3,
  recommend: 6,
  situational: 4,
  explain: 3,
};

/**
 * LLM이 타입별 개수를 덜 만들어도 템플릿으로 채운다.
 *
 * 프롬프트로 개수를 지시해도 모델은 형태가 비슷한 질문(특히 direct)을
 * 스스로 중복 제거해 줄여버린다. 표본 수는 신뢰도 배지와 커버리지 점수에
 * 직접 영향을 주므로 코드에서 보장한다.
 */
export function ensureQueryCounts(
  generated: GeneratedQuery[],
  input: GenerateQueriesInput
): GeneratedQuery[] {
  const seen = new Set(generated.map((q) => normalizeText(q.text)));
  const out = [...generated];

  for (const [type, target] of Object.entries(TARGET_COUNTS) as [QueryType, number][]) {
    const have = out.filter((q) => q.type === type).length;
    if (have >= target) continue;

    for (const candidate of fallbackQueries(type, input)) {
      if (out.filter((q) => q.type === type).length >= target) break;
      const key = normalizeText(candidate.text);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(candidate);
    }
  }

  return out;
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, "").replace(/[?!.,·]/g, "").toLowerCase();
}

/**
 * 한글 조사를 앞 글자의 받침에 맞춰 고른다.
 * 받침을 무시하면 "바다와하늘처럼는" 같은 문장이 고객에게 그대로 노출된다.
 */
function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0);
  // 한글 음절 영역이 아니면(영문·숫자 등) 받침 없음으로 취급한다.
  if (code < 0xac00 || code > 0xd7a3) return withoutBatchim;
  return (code - 0xac00) % 28 !== 0 ? withBatchim : withoutBatchim;
}

const eun = (w: string) => `${w}${josa(w, "은", "는")}`;
const i = (w: string) => `${w}${josa(w, "이", "가")}`;
const eul = (w: string) => `${w}${josa(w, "을", "를")}`;

/** 부족분을 채울 템플릿. 서로 다른 각도가 되도록 나열 순서를 잡았다. */
function fallbackQueries(type: QueryType, input: GenerateQueriesInput): GeneratedQuery[] {
  const name = input.brandName;
  const region = input.region;
  const cats = input.categories.length ? input.categories : ["전문 분야"];
  const auds = input.audiences.length ? input.audiences : ["일반 고객"];

  switch (type) {
    case "direct":
      return [
        { text: `${eun(name)} 어떤 곳이야?`, type, sub_category: "직접 검색", importance: 3 },
        { text: `${name}에 대해 알려줘`, type, sub_category: "직접 검색", importance: 3 },
        { text: `${name} ${region}`, type, sub_category: "직접 검색", importance: 2 },
        { text: `${name} 평판 어때?`, type, sub_category: "직접 검색", importance: 2 },
      ];

    case "explain":
      return [
        { text: `${name}의 주요 서비스는 무엇인가요?`, type, sub_category: "설명 검증", importance: 2 },
        { text: `${eun(name)} 어느 지역에서 활동하나요?`, type, sub_category: "설명 검증", importance: 2 },
        { text: `${name}의 대표 실적은 무엇인가요?`, type, sub_category: "설명 검증", importance: 2 },
        { text: `${name}의 최근 활동은 무엇인가요?`, type, sub_category: "설명 검증", importance: 2 },
      ];

    case "recommend":
      return [
        ...cats.map((c) => ({
          text: `${region}에서 ${c} 추천해줘`,
          type,
          sub_category: "지역 기반 추천",
          importance: 3,
        })),
        ...cats.map((c) => ({
          text: `${c} 중에 평판 좋은 곳 알려줘`,
          type,
          sub_category: "평판 기반 추천",
          importance: 2,
        })),
        ...cats.map((c) => ({
          text: `${c} 경험 많은 곳은 어디야?`,
          type,
          sub_category: "전문성 기반 추천",
          importance: 2,
        })),
      ];

    case "situational":
      return [
        ...auds.map((a) => ({
          text: `${a}인데 ${i(cats[0])} 필요해. 어디에 맡기면 좋을까?`,
          type,
          sub_category: "대상 기반 추천",
          importance: 3,
        })),
        ...cats.map((c) => ({
          text: `${eul(c)} 처음 맡기려고 하는데 어디가 좋을지 추천해줘`,
          type,
          sub_category: "상황 기반 추천",
          importance: 2,
        })),
      ];

    default:
      return [];
  }
}

// Entity-type-specific query templates per PRD 3.3 (엔터티 유형별 질의 체계).
function mockQueries(input: GenerateQueriesInput): GeneratedQuery[] {
  const cat = input.categories[0] || "전문 분야";
  const cat2 = input.categories[1] || cat;
  const aud = input.audiences[0] || "일반 고객";
  const name = input.brandName;
  const region = input.region;

  const direct: GeneratedQuery[] = [
    { text: `${name}는 어떤 곳인가요?`, type: "direct", sub_category: "직접 검색", importance: 3 },
    { text: `${name}에 대해 알려줘`, type: "direct", sub_category: "직접 검색", importance: 3 },
    { text: `${name} ${region}`, type: "direct", sub_category: "직접 검색", importance: 2 },
  ];
  const explain: GeneratedQuery[] = [
    { text: `${name}의 전문 분야/업종은 무엇인가요?`, type: "explain", sub_category: "설명 검증", importance: 2 },
    { text: `${name}는 어느 지역에서 활동하나요?`, type: "explain", sub_category: "설명 검증", importance: 2 },
    { text: `${name}의 최근 활동/실적은 무엇인가요?`, type: "explain", sub_category: "설명 검증", importance: 2 },
  ];

  let middle: GeneratedQuery[];
  switch (input.entityType) {
    case "자영업/로컬":
      middle = [
        { text: `${region}에서 ${cat} 잘하는 곳 추천해줘`, type: "recommend", sub_category: "지역 기반 추천", importance: 3 },
        { text: `${region} ${cat} 맛집/명소 알려줘`, type: "recommend", sub_category: "지역 기반 추천", importance: 3 },
        { text: `${aud}와 가기 좋은 ${cat} 추천해줘`, type: "situational", sub_category: "용도 기반 추천", importance: 3 },
        { text: `${region}에서 가성비 좋은 ${cat} 어디야?`, type: "recommend", sub_category: "가격대 추천", importance: 2 },
        { text: `${region} ${cat} 중에 후기 좋은 곳 추천`, type: "recommend", sub_category: "평판 기반 추천", importance: 2 },
        { text: `주말에 ${region}에서 갈 만한 ${cat} 추천해줘`, type: "situational", sub_category: "상황 기반 추천", importance: 2 },
        { text: `${region} ${cat} 처음 가보는데 어디가 좋아?`, type: "situational", sub_category: "상황 기반 추천", importance: 1 },
        { text: `${region}에서 ${cat2} 관련해서 유명한 곳 알려줘`, type: "recommend", sub_category: "지역 기반 추천", importance: 2 },
        { text: `${region} ${cat} 예약하기 좋은 곳은?`, type: "situational", sub_category: "용도 기반 추천", importance: 1 },
        { text: `${region} ${cat} 몇 군데 비교해서 알려줘`, type: "compare", sub_category: "비교", importance: 1 },
      ];
      break;
    case "기업/제품":
      middle = [
        { text: `국내 ${cat} 기업 추천해줘`, type: "recommend", sub_category: "산업 기반 추천", importance: 3 },
        { text: `${cat} 잘하는 회사 알려줘`, type: "recommend", sub_category: "산업 기반 추천", importance: 3 },
        { text: `${aud}용 ${cat} 솔루션 추천해줘`, type: "recommend", sub_category: "문제 해결 추천", importance: 3 },
        { text: `${cat} 도입하려는데 어떤 업체가 좋을까?`, type: "situational", sub_category: "문제 해결 추천", importance: 2 },
        { text: `${cat} 분야에서 신뢰할 만한 기업은?`, type: "recommend", sub_category: "신뢰·평판 추천", importance: 2 },
        { text: `${cat} 스타트업 중 주목할 만한 곳 알려줘`, type: "recommend", sub_category: "산업 기반 추천", importance: 2 },
        { text: `${cat2} 관련 제품/서비스 추천해줘`, type: "recommend", sub_category: "문제 해결 추천", importance: 2 },
        { text: `중소기업이 쓰기 좋은 ${cat} 추천`, type: "situational", sub_category: "대상 기반 추천", importance: 2 },
        { text: `${cat} 업체들 장단점 비교해줘`, type: "compare", sub_category: "경쟁 비교", importance: 2 },
        { text: `${cat} 시장에서 평판 좋은 회사 알려줘`, type: "recommend", sub_category: "신뢰·평판 추천", importance: 1 },
      ];
      break;
    case "전문 서비스":
      middle = [
        { text: `${cat} 전문가 추천해줘`, type: "recommend", sub_category: "전문분야 추천", importance: 3 },
        { text: `${region}에서 ${cat} 잘하는 곳 추천`, type: "recommend", sub_category: "지역 기반 추천", importance: 3 },
        { text: `${aud} 대상 ${cat} 서비스 추천해줘`, type: "recommend", sub_category: "고객 유형 추천", importance: 3 },
        { text: `${cat} 상담 받고 싶은데 어디가 좋을까?`, type: "situational", sub_category: "상황 기반 추천", importance: 2 },
        { text: `${cat} 관련 실적 좋은 곳 알려줘`, type: "recommend", sub_category: "사례 기반 추천", importance: 2 },
        { text: `믿을 만한 ${cat} 업체 알려줘`, type: "recommend", sub_category: "신뢰도 추천", importance: 2 },
        { text: `${cat2} 의뢰하려면 어디로 가야 해?`, type: "situational", sub_category: "상황 기반 추천", importance: 2 },
        { text: `처음 ${cat} 맡기는데 추천할 곳은?`, type: "situational", sub_category: "상황 기반 추천", importance: 1 },
        { text: `${cat} 비용 합리적인 곳 추천`, type: "recommend", sub_category: "가격 추천", importance: 1 },
        { text: `${cat} 서비스 몇 곳 비교해줘`, type: "compare", sub_category: "비교", importance: 1 },
      ];
      break;
    default: // 개인 브랜드/강사
      middle = [
        { text: `${cat} 분야 전문가 추천해줘`, type: "recommend", sub_category: "전문분야 추천", importance: 3 },
        { text: `${cat} 강사/전문가 누가 유명해?`, type: "recommend", sub_category: "전문분야 추천", importance: 3 },
        { text: `${aud} 대상 ${cat} 강연자 추천해줘`, type: "recommend", sub_category: "대상 기반 추천", importance: 3 },
        { text: `${cat} 관련해서 믿을 만한 사람이 누구야?`, type: "recommend", sub_category: "신뢰도 추천", importance: 2 },
        { text: `${cat} 배우고 싶은데 누구한테 배우면 좋을까?`, type: "situational", sub_category: "상황 기반 추천", importance: 2 },
        { text: `${cat2} 콘텐츠 만드는 사람 추천해줘`, type: "recommend", sub_category: "전문분야 추천", importance: 2 },
        { text: `기업 교육용 ${cat} 강사 추천`, type: "situational", sub_category: "대상 기반 추천", importance: 2 },
        { text: `실무 경험 많은 ${cat} 전문가 알려줘`, type: "recommend", sub_category: "경력 차별점 추천", importance: 2 },
        { text: `${cat} 입문자에게 추천하는 강의/강사는?`, type: "situational", sub_category: "상황 기반 추천", importance: 1 },
        { text: `${cat} 강사들 스타일 비교해줘`, type: "compare", sub_category: "비교", importance: 1 },
      ];
  }

  return [...direct, ...middle, ...explain];
}

// ---------------- 2. Evidence judgment ----------------

export interface JudgeEvidenceInput {
  brandName: string;
  aliases: string[];
  queryText: string;
  queryType: QueryType;
  responseText: string;
  groundTruth: { field: string; value: string }[];
}

export interface EvidenceJudgment {
  entity_found: boolean;
  mention_type: MentionType;
  position: number | null;
  description_accuracy: number;
  conflicts: string[];
  source_types: SourceType[];
  citations: string[];
  confidence: number;
}

export async function judgeEvidence(input: JudgeEvidenceInput): Promise<EvidenceJudgment> {
  if (isMockMode()) return mockJudgment(input);

  const system = `당신은 AI 답변 속 브랜드 언급을 판정하는 분석가다. 아래 규칙을 따라 JSON만 출력하라.
스키마: {"entity_found": boolean, "mention_type": "recommended_candidate"|"simple_mention"|"not_found"|"collection_failed",
"position": number|null, "description_accuracy": number(0~1), "conflicts": string[], "source_types": string[](official_site|official_sns|map_listing|marketplace|news_media|institution|author_profile|ugc|unknown),
"citations": string[](응답에 등장한 URL 또는 출처명), "confidence": number(0~1)}
판정 기준:
- "recommended_candidate": 응답의 추천 목록·후보·적합 사례에 브랜드가 명시적으로 포함됨
- "simple_mention": 출처·배경 설명에서 이름만 등장, 추천 후보 아님
- "not_found": 브랜드가 응답에 등장하지 않음
- position: 추천 목록에서 몇 번째로 언급되는지(1부터), 추천 후보가 아니면 null
- description_accuracy: 응답 내용이 제공된 ground truth(승인된 사실)와 얼마나 일치하는지
- conflicts: ground truth와 충돌하거나 과거 정보/오류로 보이는 부분을 한국어 문장으로 나열 (없으면 빈 배열)
${FORBIDDEN_NOTICE}`;

  const user = `brand_name: ${input.brandName}
aliases: ${input.aliases.join(", ") || "(없음)"}
query_type: ${input.queryType}
query: ${input.queryText}
ground_truth:
${input.groundTruth.map((g) => `- ${g.field}: ${g.value}`).join("\n") || "(없음)"}

ai_response:
"""
${input.responseText}
"""`;

  return callJSON<EvidenceJudgment>(system, user);
}

/** 응답 본문에 실제로 등장한 URL을 뽑는다. 실제 판정 모델도 같은 일을 한다. */
function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s<>"')\]]+/g) ?? [];
  // 문장 끝 구두점이 URL에 붙어 들어오는 경우를 정리한다.
  const cleaned = matches.map((u) => u.replace(/[.,;:]+$/, ""));
  return Array.from(new Set(cleaned));
}

function mockJudgment(input: JudgeEvidenceInput): EvidenceJudgment {
  const found = input.responseText.includes(input.brandName) || input.aliases.some((a) => input.responseText.includes(a));
  const isRecommendish = /추천|후보|고려할 만한|좋습니다/.test(input.responseText);
  const mention: MentionType = !found ? "not_found" : isRecommendish ? "recommended_candidate" : "simple_mention";

  // 인용은 응답에 실제로 있는 URL에서만 뽑는다. 없으면 빈 배열이다.
  // 예전에는 URL이 없을 때 example.com 자리표시자를 넣었는데, 그 가짜 주소가
  // 리포트 근거 부록과 PDF에까지 그대로 실려 나갔다. 검증 불가능한 출처를
  // 지어내느니 "출처 없음"이 정직하고, 출처 신뢰도 축도 그래야 실제로 움직인다.
  const citations = extractUrls(input.responseText);

  return {
    entity_found: found,
    mention_type: mention,
    position: mention === "recommended_candidate" ? 2 : null,
    description_accuracy: found ? 0.8 : 0,
    conflicts: /과거|예전/.test(input.responseText) ? ["과거 직책/정보로 보이는 표현이 있음"] : [],
    source_types: found ? ["official_site", "news_media"] : ["unknown"],
    citations,
    confidence: found ? 0.75 : 0.5,
  };
}

// ---------------- 3. Report narrative generation ----------------

export interface GenerateReportInput {
  brandName: string;
  entityType: EntityType;
  region: string;
  categories: string[];
  audiences: string[];
  officialAssets: string[];
  axes: AxisScore[];
  total: number;
  grade: string;
  gradeLabel: string;
  queries: QueryRow[];
  evidence: EvidenceRow[];
}

export interface ReportNarrative {
  one_line: string;
  findings: { status: "good" | "meh" | "needs_work" | "risk" | "unknown"; title: string; detail: string; evidence_ids: string[] }[];
  why_weak: string;
  actions: { priority: number; title: string; channel: string; rationale: string; copy: string; steps?: string[] }[];
  copy_assets: {
    one_sentence: string;
    three_sentence: string;
    meta_description: string;
    common_profile: string;
    faq: { q: string; a: string }[];
  };
  recheck_checklist?: { item: string; how: string; pass_criteria: string }[];
  limitations: string[];
}

export async function generateReportNarrative(input: GenerateReportInput): Promise<ReportNarrative> {
  if (isMockMode()) return mockReport(input);

  const system = `당신은 GEO/AEO(생성형 AI 검색 최적화) 진단 리포트 작성자다. 아래 규칙을 지켜 JSON만 출력하라.
스키마: {"one_line": string(500자 이내), "findings": [{"status":"good"|"meh"|"needs_work"|"risk"|"unknown","title":string,"detail":string,"evidence_ids":string[]}] (6~10개),
"why_weak": string(추천에서 약한 구조적 이유 설명), "actions": [{"priority":1..5,"title":string,"channel":string,"rationale":string,"copy":string,"steps":string[]}] (정확히 5개, 우선순위 순.
steps는 3~5개의 단계별 실행 가이드로, 마케팅 지식이 없는 고객사 담당자가 그대로 따라 할 수 있게 명령형 한 문장씩 작성하라 — 어디에 로그인/접속해서, 무엇을 열고, 어떤 문안을 어디에 붙여넣는지 수준으로 구체적으로),
"copy_assets": {"one_sentence":string,"three_sentence":string,"meta_description":string,"common_profile":string,"faq":[{"q":string,"a":string}](4~6개)},
"recheck_checklist": [{"item":string,"how":string,"pass_criteria":string}] (정확히 5개),
"limitations": string[] (표본·수집 한계 고지 문구 2~4개)}

## recheck_checklist 작성 규칙 (30일 뒤 스스로 점검하는 표)
- item: 무엇을 점검하는가. 위 actions에서 실행한 개선이 실제로 먹혔는지 확인하는 항목으로 잡아라.
- how: 어떻게 확인하는가. "ChatGPT에 '<구체적 질문>'을 입력한다"처럼 그대로 따라 할 수 있게 쓴다.
- pass_criteria: **통과 기준을 반드시 측정 가능한 문장으로 쓴다.** "확인해보세요"는 점검이 아니다.
  단 100% 재현으로 잡지 마라 — 생성형 답변은 매번 흔들려서 실제로 개선됐는데도 실패로 읽힌다.
  "AI 3곳 중 2곳 이상에서 이름이 등장" 처럼 **다수결 형태로 느슨하게** 잡아라.
모든 findings는 evidence_ids 배열에 근거가 된 evidence id를 포함해야 한다(없으면 빈 배열 대신 관련 있어 보이는 id를 최대한 연결).
수집 실패는 미노출로 표현하지 마라. 확인된 사실과 추론·권고를 분리하라. 점수가 낮아도 비난하지 말고 수정 가능한 구조적 원인을 설명하라.
${FORBIDDEN_NOTICE}`;

  const evidenceSummary = input.evidence
    .filter((e) => e.judged_at)
    .map((e) => {
      const q = input.queries.find((qq) => qq.id === e.query_id);
      return `[${e.id}] (${q?.type}/${q?.sub_category ?? "-"}) Q: "${q?.text}" → found=${e.entity_found} mention=${e.mention_type} accuracy=${e.description_accuracy} conflicts=${e.conflicts}`;
    })
    .join("\n");

  const user = `브랜드: ${input.brandName} (${input.entityType})
지역: ${input.region}
대표 카테고리: ${input.categories.join(", ")}
목표 청중: ${input.audiences.join(", ")}
공식 자산: ${input.officialAssets.join(", ") || "(없음)"}

5축 점수 (총점 ${input.total}/100, 등급 ${input.grade} · ${input.gradeLabel}):
${input.axes.map((a) => `- ${a.label}: ${a.raw}/${a.max} (${a.judgment})`).join("\n")}

증거 요약:
${evidenceSummary || "(증거 없음)"}`;

  return callJSON<ReportNarrative>(system, user);
}

function mockReport(input: GenerateReportInput): ReportNarrative {
  const weakAxis = [...input.axes].sort((a, b) => a.raw / a.max - b.raw / b.max)[0];
  return {
    one_line: `${input.brandName}는 직접 검색에서는 어느 정도 확인되지만, "${weakAxis.label}" 축이 특히 약해 범주형 추천 질문에서 후보로 잘 등장하지 않습니다.`,
    findings: input.axes.map((a) => ({
      status: a.raw / a.max >= 0.8 ? "good" : a.raw / a.max >= 0.6 ? "meh" : a.raw / a.max >= 0.4 ? "needs_work" : "risk",
      title: a.label,
      detail: a.judgment,
      evidence_ids: input.evidence.filter((e) => e.judged_at).slice(0, 2).map((e) => e.id),
    })),
    why_weak: "브랜드 정보가 여러 채널에 분산되어 있어 AI가 대표 정체성을 한 문장으로 압축하기 어렵고, 추천형 질의의 앵커가 될 명확한 카테고리 문장이 부족합니다.",
    actions: [
      {
        priority: 1,
        title: "대표 1문장을 전 채널에 통일",
        channel: "공식 사이트·SNS",
        rationale: "채널 일관성과 범주형 추천 신호 강화",
        copy: `"${input.brandName}는 ${input.categories[0] || "전문 분야"} 전문가입니다."`,
        steps: [
          "아래 '개선 문안'의 1문장 정의를 복사하세요",
          "공식 사이트 메인 화면의 첫 소개 문장을 이 문안으로 교체하세요",
          "인스타그램·유튜브 등 모든 SNS 프로필 소개란에 같은 문장을 붙여넣으세요",
          "채널마다 문구가 한 글자도 다르지 않은지 최종 확인하세요",
        ],
      },
      {
        priority: 2,
        title: "대상별 서비스 섹션 추가",
        channel: "공식 사이트",
        rationale: "추천형 질문의 대상·문제·가치 명확화",
        copy: "누구를 위한 서비스인지 한 문단으로 정리",
        steps: [
          "공식 사이트에 '서비스 안내' 섹션을 새로 만드세요",
          `'${input.audiences[0] || "핵심 고객"}을 위한 / 어떤 문제를 / 무엇으로 해결'을 각 한 문단씩 작성하세요`,
          "고객 유형별 대표 사례나 결과를 한 줄씩 덧붙이세요",
        ],
      },
      {
        priority: 3,
        title: "추천형 FAQ 구축",
        channel: "사이트·SNS",
        rationale: "질문-답 구조로 범주 신호 강화",
        copy: "자주 묻는 질문 5개 이상 등록",
        steps: [
          "이 진단의 '범주형 추천' 질문 목록에서 자주 받을 질문 5개를 고르세요",
          `각 질문에 2~3문장으로 답을 쓰되, '${input.brandName}'와 '${input.categories[0] || "대표 카테고리"}'를 자연스럽게 포함하세요`,
          "공식 사이트 FAQ 페이지와 SNS 고정글에 게시하세요",
        ],
      },
      {
        priority: 4,
        title: "최근 활동 허브 갱신",
        channel: "공식 사이트",
        rationale: "최신성 신호와 실적 누적",
        copy: "월 1회 이상 활동/업데이트 게시",
        steps: [
          "공식 사이트에 '최근 소식' 섹션을 만드세요",
          "최근 3개월 활동·실적을 날짜와 함께 정리해 올리세요",
          "매월 1회 갱신 일정을 캘린더에 등록해 루틴으로 만드세요",
        ],
      },
      {
        priority: 5,
        title: "구조화 데이터 추가",
        channel: "공식 사이트",
        rationale: "AI가 정보를 정확히 파싱하도록 지원",
        copy: "schema.org/JSON-LD 마크업 적용",
        steps: [
          "사이트 담당자(또는 개발자)에게 schema.org JSON-LD 적용을 요청하세요",
          "Organization/Person·서비스·FAQ 스키마를 메인 페이지에 추가하세요",
          "Google Rich Results Test에서 URL을 넣어 적용 여부를 확인하세요",
        ],
      },
    ],
    copy_assets: {
      one_sentence: `${input.brandName}는 ${input.categories[0] || "전문 분야"} 전문가로, ${input.audiences[0] || "고객"}을 위한 서비스를 제공합니다.`,
      three_sentence: `${input.brandName}는 ${input.categories[0] || "전문 분야"} 분야에서 활동하는 전문가입니다. ${input.audiences[0] || "고객"}이 문제를 해결할 수 있도록 돕습니다. ${input.region}을 중심으로 활동하며 지속적으로 실적을 쌓고 있습니다.`,
      meta_description: `${input.brandName} - ${input.categories[0] || "전문 분야"} 전문가. ${input.audiences[0] || "고객"}을 위한 서비스 제공.`,
      common_profile: `${input.categories[0] || "전문 분야"} 전문가 | ${input.region} 기반 | ${input.audiences.join(", ") || "고객 대상"}`,
      faq: [
        { q: `${input.brandName}는 어떤 전문 분야인가요?`, a: `${input.categories.join(", ") || "전문 분야"}를 중심으로 활동합니다.` },
        { q: "주로 어떤 고객과 함께 하나요?", a: `${input.audiences.join(", ") || "다양한 고객"}과 함께 합니다.` },
      ],
    },
    recheck_checklist: [
      {
        item: "대표 1문장이 전 채널에 동일하게 적용됐는가",
        how: "공식 사이트·인스타·유튜브 프로필 소개란을 나란히 열어 문장을 비교한다",
        pass_criteria: "3개 채널 이상에서 문장이 한 글자도 다르지 않음",
      },
      {
        item: "직접 검색에서 정체성이 정확히 설명되는가",
        how: `ChatGPT·Perplexity·Gemini에 "${input.brandName}는 어떤 일을 하나요?"를 각각 입력한다`,
        pass_criteria: `AI 3곳 중 2곳 이상이 "${input.categories[0] || "대표 카테고리"}"를 언급`,
      },
      {
        item: "범주형 추천 질문에서 후보로 등장하는가",
        how: `"${input.categories[0] || "해당 분야"} 전문가 추천해줘"를 AI 3곳에 각각 입력한다`,
        pass_criteria: "AI 3곳 중 1곳 이상에서 후보로 등장 (진단 시점 0곳이었다면 1곳도 개선)",
      },
      {
        item: "제3자 근거가 새로 확보됐는가",
        how: "기고·인터뷰·행사 소개 등 본인이 운영하지 않는 사이트의 링크를 센다",
        pass_criteria: "진단 시점 대비 제3자 출처 1건 이상 증가",
      },
      {
        item: "최신 활동 신호가 살아 있는가",
        how: "공식 사이트 '최근 소식' 섹션의 최상단 게시물 날짜를 확인한다",
        pass_criteria: "최근 30일 이내 게시물이 1건 이상 존재",
      },
    ],
    limitations: ["본 진단은 사용자가 제출한 증거를 기반으로 하며 표본이 제한적일 수 있습니다.", "AI 응답은 시점·모델에 따라 달라질 수 있어 절대 순위가 아닌 관측 시점의 지표입니다."],
  };
}

export function assembleReportJSON(params: {
  brandName: string;
  categories: string[];
  audiences: string[];
  officialAssets: string[];
  axes: AxisScore[];
  total: number;
  grade: string;
  gradeLabel: string;
  trustBadge: "high" | "medium" | "low";
  trustLabel: string;
  sampleSize: number;
  engineCount: number;
  failureRate: number;
  narrative: ReportNarrative;
}): ReportJSON {
  return {
    summary: { one_line: params.narrative.one_line },
    score: {
      total: params.total,
      grade: params.grade,
      grade_label: params.gradeLabel,
      trust_badge: params.trustBadge,
      trust_label: params.trustLabel,
      sample_size: params.sampleSize,
      engine_count: params.engineCount,
      failure_rate: params.failureRate,
    },
    findings: params.narrative.findings,
    entity: {
      keywords: params.categories,
      audiences: params.audiences,
      official_assets: params.officialAssets,
    },
    axes: params.axes,
    why_weak: params.narrative.why_weak,
    actions: params.narrative.actions,
    copy_assets: params.narrative.copy_assets,
    recheck_checklist: params.narrative.recheck_checklist,
    limitations: params.narrative.limitations,
  };
}
