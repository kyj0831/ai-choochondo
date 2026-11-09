import type Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_MODEL, getAnthropic, getOpenAI, getProvider, OPENAI_REPORT_MODEL } from "./openai";
import type { Analysis, RemixResult } from "./bibl";
import type { VideoResult } from "./youtube";

/**
 * BIBL의 AI 기능 — 썸네일·제목 해부, 내 버전 만들기.
 *
 * LLM 키가 있으면 썸네일 이미지까지 읽는 AI 해부를 쓰고, 없으면 제목 규칙과 숫자 지표만으로
 * 해부한다(썸네일 해부는 비움). 규칙 기반 후킹 분류는 AI 모드에서도 보조로 쓴다.
 */

// ── 제목 후킹 유형 (규칙) ─────────────────────────────────────────────

export const HOOKS: { name: string; test: RegExp; meaning: string }[] = [
  { name: "숫자", test: /\d+\s*(가지|개|분|초|일|주|달|개월|년|만|억|위|배|kg|키로|원|%|번|권|시간)|TOP\s*\d/i, meaning: "결과나 분량을 숫자로 약속해 구체적으로 보이게 한다" },
  { name: "질문", test: /\?|？|(일까|을까|ㄹ까|나요|는가|할까|인가)|(^|\s)(왜|어떻게|무엇|뭐가|뭘)/, meaning: "답이 궁금해지는 질문을 던져 클릭으로 답을 확인하게 한다" },
  { name: "반전·충격", test: /(알고\s?보니|결국|충격|반전|역대급|소름|미쳤|대박|경악|난리|ㄷㄷ|실화)/, meaning: "예상과 다른 결과를 암시해 확인하고 싶게 만든다" },
  { name: "손해 회피", test: /(하지\s?마|모르면|손해|후회|망하|망한|실수|절대|피해야|조심|위험|버리|낭비)/, meaning: "모르면 손해라는 불안을 건드려 지금 봐야 할 이유를 만든다" },
  { name: "비밀 공개", test: /(비밀|진짜\s?이유|아무도|몰랐던|숨겨진|공개|최초|단독|꿀팁|안\s?알려주)/, meaning: "남들이 모르는 걸 알려준다는 약속으로 특별한 정보처럼 보이게 한다" },
  { name: "비교", test: /(\bvs\b|VS|대결|차이|비교|보다\s)/i, meaning: "둘을 맞붙여 보는 사람이 판단하고 싶게 만든다" },
  { name: "경험담", test: /(했더니|해봤|해\s?봤|직접|후기|만에|동안|살아보니|써보니|먹어보니)/, meaning: "직접 해 본 사람의 결과라서 믿음이 가고 궁금해진다" },
  { name: "대사 인용", test: /["“'‘「][^"”'’」]{2,}["”'’」]/, meaning: "실제 말이나 대사로 장면을 떠올리게 한다" },
  { name: "대상 지목", test: /(직장인|워킹맘|엄마|아빠|초보|입문|20대|30대|40대|50대|부모|학생|자영업|사장님|주부|신혼)/, meaning: "보는 사람을 콕 집어 '내 얘기'로 느끼게 한다" },
];

const STOP = new Set(["그리고", "하는", "있는", "없는", "정말", "진짜", "이것", "그냥", "영상", "공개", "방법", "후기", "직접"]);

export function classifyTitle(title: string): Analysis["title"] {
  const clean = title.replace(/#[^\s#]+/g, " ").replace(/\s+/g, " ").trim();
  const hooks = HOOKS.filter((h) => h.test.test(clean)).map((h) => h.name);
  if (hooks.length === 0) hooks.push("정보 설명형");

  // 핵심 키워드: 괄호·기호를 뺀 단어 중 처음 나오는 2자 이상 일반 단어
  const words = clean.replace(/[\[\]()「」『』|｜:：…,.!?"“”'‘’~\-]/g, " ").split(/\s+/).filter(Boolean);
  const keyword = words.find((w) => w.length >= 2 && !STOP.has(w) && !/^\d/.test(w)) ?? "";
  let keywordPosition: Analysis["title"]["keywordPosition"] = "없음";
  if (keyword) {
    const pos = clean.indexOf(keyword) / Math.max(1, clean.length);
    keywordPosition = pos < 0.34 ? "앞" : pos < 0.67 ? "가운데" : "뒤";
  }
  const meanings = HOOKS.filter((h) => hooks.includes(h.name)).map((h) => h.meaning);
  return {
    hooks,
    keyword,
    keywordPosition,
    length: clean.length,
    why: meanings.length ? meanings.map((m) => `${m}.`).join(" ") : "내용을 그대로 설명하는 제목입니다. 주제 자체의 수요가 컸을 가능성이 큽니다.",
  };
}

// ── 해부 ──────────────────────────────────────────────────────────────

function ratio(n: number | null): string {
  if (n == null) return "-";
  return n >= 10 ? `${Math.round(n)}배` : `${n.toFixed(1)}배`;
}

function ruleAnalysis(v: VideoResult): Analysis {
  const title = classifyTitle(v.title);
  const why: string[] = [];
  if (v.performanceRatio != null)
    why.push(
      v.performanceRatio >= 2
        ? `구독자의 ${ratio(v.performanceRatio)} 조회 — 구독자 밖으로 퍼졌습니다. 추천·검색으로 처음 보는 사람이 눌렀다는 뜻입니다.`
        : `구독자 대비 ${ratio(v.performanceRatio)} 조회 — 주로 기존 구독자가 본 영상입니다.`
    );
  if (v.contributionRatio != null)
    why.push(
      v.contributionRatio >= 2
        ? `이 채널 평균의 ${ratio(v.contributionRatio)} — 같은 채널 안에서도 주제나 포장이 특히 먹혔습니다.`
        : `이 채널 평균의 ${ratio(v.contributionRatio)} — 채널 평소 수준입니다.`
    );
  why.push(`제목: ${title.hooks.join("·")} — ${title.why}`);

  const steal = title.hooks
    .filter((h) => h !== "정보 설명형")
    .slice(0, 2)
    .map((h) => `제목에 '${h}' 구조 쓰기 — ${HOOKS.find((x) => x.name === h)?.meaning ?? ""}`);
  if (title.keywordPosition === "앞") steal.push(`핵심 키워드('${title.keyword}')를 제목 맨 앞에 두기`);
  steal.push(v.durationSec <= 180 ? "3분 이하 쇼츠로 한 가지만 보여 주기" : `영상 길이 ${Math.round(v.durationSec / 60)}분 — 이 주제는 이 정도 길이도 끝까지 본다`);

  return {
    title,
    thumbnail: null,
    whyItWorked: why.slice(0, 3),
    steal: steal.slice(0, 3),
    lessonDraft: `${title.hooks[0]} 제목${title.keyword ? ` + '${title.keyword}'` : ""}로 구독자의 ${ratio(v.performanceRatio)} 조회. 내 영상 제목에도 ${title.hooks[0]} 구조를 써 보자.`,
    source: "rule",
  };
}

const ANALYSIS_SYSTEM = `당신은 유튜브 썸네일·제목 코치다. 사용자는 일과 육아를 병행하며 유튜브를 키우려는 초보 크리에이터로,
"감"이 없어 잘된 영상을 봐도 왜 잘됐는지 모른다. 잘된 영상 하나를 받아 그 이유를 쉬운 말로 해부해 준다.

규칙:
- 보이는 것과 주어진 숫자만 근거로 말한다. 썸네일에 없는 요소를 지어내지 않는다.
- 전문 용어 대신 초보가 바로 따라 할 수 있는 말로 쓴다. 각 항목은 1~2문장.
- "steal"은 문구를 베끼는 게 아니라 구조·장치를 가져가는 방법이어야 한다.
- 출력은 JSON 객체 하나.`;

function analysisUser(v: VideoResult, rule: Analysis["title"]): string {
  return `영상 정보
- 제목: ${v.title}
- 채널: ${v.channelTitle} (구독자 ${v.subscribers ?? "비공개"}명, 영상 ${v.channelVideoCount}개)
- 조회수: ${v.views}, 게시일: ${v.publishedAt.slice(0, 10)}, 길이: ${v.durationSec}초
- 성과도(조회수÷구독자): ${ratio(v.performanceRatio)}, 기여도(조회수÷채널 평균): ${ratio(v.contributionRatio)}
- 규칙 기반 제목 분류(참고): ${rule.hooks.join(", ")}

첨부한 썸네일 이미지와 위 정보를 보고 아래 JSON으로 답하라.
{
  "title": { "hooks": ["후킹 유형 1~3개. 가능한 값: ${HOOKS.map((h) => h.name).join(", ")}, 정보 설명형"], "keyword": "핵심 키워드", "keywordPosition": "앞|가운데|뒤|없음", "why": "이 제목이 클릭을 부른 이유" },
  "thumbnail": { "face": "얼굴 유무와 표정", "text": "썸네일 문구와 글자 크기·개수", "color": "주요 색과 대비", "composition": "구도(분할, 클로즈업 등)", "focus": "시선을 끄는 장치(화살표, 동그라미, 확대 등). 없으면 없다고", "titleRelation": "썸네일 문구와 제목의 관계(반복/보완/궁금증 증폭)" },
  "whyItWorked": ["잘된 이유 3개"],
  "steal": ["내 영상에 가져갈 구조 3개"],
  "lessonDraft": "사용자가 보관함에 남길 '배운 점' 한 줄 초안 (40자 안팎)"
}`;
}

async function visionJSON(system: string, user: string, imageUrl: string): Promise<any> {
  const provider = getProvider();
  if (provider === "openai") {
    const c = await getOpenAI().chat.completions.create({
      model: OPENAI_REPORT_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: [
            ...(imageUrl ? [{ type: "image_url" as const, image_url: { url: imageUrl } }] : []),
            { type: "text" as const, text: user },
          ],
        },
      ],
    });
    return JSON.parse(c.choices[0]?.message?.content ?? "{}");
  }
  const content: Anthropic.ContentBlockParam[] = [];
  if (imageUrl) content.push({ type: "image", source: { type: "url", url: imageUrl } });
  content.push({ type: "text", text: `${user}\n\n반드시 유효한 JSON 객체 하나만 출력하세요.` });
  const msg = await getAnthropic().messages.create({ model: ANTHROPIC_MODEL, max_tokens: 4000, system, messages: [{ role: "user", content }] });
  const text = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
  return JSON.parse(m[0]);
}

const arr = (x: unknown, n: number): string[] => (Array.isArray(x) ? x.map(String).filter(Boolean).slice(0, n) : []);

export async function analyzeVideo(v: VideoResult): Promise<Analysis> {
  const rule = ruleAnalysis(v);
  if (getProvider() === "mock") return rule;

  // 고해상도 썸네일을 우선 쓴다. 데모 영상은 이미지가 없다.
  const img = v.thumbnail ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : "";
  const raw = await visionJSON(ANALYSIS_SYSTEM, analysisUser(v, rule.title), img);
  const t = raw.title ?? {};
  const th = raw.thumbnail;
  const pos = ["앞", "가운데", "뒤", "없음"].includes(t.keywordPosition) ? t.keywordPosition : rule.title.keywordPosition;
  return {
    title: {
      hooks: arr(t.hooks, 3).length ? arr(t.hooks, 3) : rule.title.hooks,
      keyword: String(t.keyword ?? rule.title.keyword),
      keywordPosition: pos,
      length: rule.title.length,
      why: String(t.why ?? rule.title.why),
    },
    thumbnail:
      th && img
        ? {
            face: String(th.face ?? ""),
            text: String(th.text ?? ""),
            color: String(th.color ?? ""),
            composition: String(th.composition ?? ""),
            focus: String(th.focus ?? ""),
            titleRelation: String(th.titleRelation ?? ""),
          }
        : null,
    whyItWorked: arr(raw.whyItWorked, 3).length ? arr(raw.whyItWorked, 3) : rule.whyItWorked,
    steal: arr(raw.steal, 3).length ? arr(raw.steal, 3) : rule.steal,
    lessonDraft: String(raw.lessonDraft ?? rule.lessonDraft).slice(0, 120),
    source: "ai",
  };
}

// ── 내 버전 만들기 ────────────────────────────────────────────────────

const TITLE_TEMPLATES: Record<string, (t: string) => string> = {
  숫자: (t) => `${t}, 딱 3가지만 바꿨더니 달라진 것`,
  질문: (t) => `${t}, 왜 나만 늘 제자리일까?`,
  "반전·충격": (t) => `${t} 해봤는데… 결과가 예상과 완전히 달랐습니다`,
  "손해 회피": (t) => `${t}, 이거 모르고 시작하면 시간만 버립니다`,
  "비밀 공개": (t) => `아무도 안 알려주는 ${t}의 진짜 순서`,
  비교: (t) => `${t} A vs B, 직접 비교해 봤습니다`,
  경험담: (t) => `${t} 한 달 동안 직접 해 본 솔직한 결과`,
  "대사 인용": (t) => `"${t}? 그거 원래 이렇게 하는 거야" 들은 날`,
  "대상 지목": (t) => `일하면서 아이 키우는 사람을 위한 ${t}`,
  "정보 설명형": (t) => `${t} 처음부터 끝까지 정리`,
};

function ruleRemix(v: VideoResult, a: Analysis | null, topic: string): RemixResult {
  const hooks = a?.title.hooks ?? classifyTitle(v.title).hooks;
  const order = Array.from(new Set([...hooks, "경험담", "숫자", "손해 회피", "질문", "대상 지목", "비밀 공개"]));
  const titles = order.slice(0, 5).map((h) => ({
    title: (TITLE_TEMPLATES[h] ?? TITLE_TEMPLATES["정보 설명형"])(topic),
    hook: h,
    why: hooks.includes(h) ? `레퍼 제목과 같은 '${h}' 구조` : HOOKS.find((x) => x.name === h)?.meaning ?? "",
  }));
  const short = topic.length > 8 ? topic.slice(0, 8) : topic;
  return {
    titles,
    thumbnails: [
      { text: `${short} 이렇게!`, layout: "내 얼굴 클로즈업(놀란·확신하는 표정) + 큰 글자 4~6자, 배경은 단색", why: "얼굴과 짧은 글자가 작은 화면에서도 한눈에 읽힌다" },
      { text: "전 → 후", layout: "좌우 2분할: 왼쪽 '전', 오른쪽 '후' + 가운데 화살표", why: "변화를 한 장으로 보여 줘 결과가 궁금해진다" },
      { text: "3가지", layout: "결과물 한 컷 + 큰 숫자 강조 + 빨간 동그라미 하나", why: "숫자와 동그라미가 시선을 한 곳에 모은다" },
    ],
    caution: "레퍼의 문구·이미지를 그대로 쓰지 말고 구조만 가져오세요. 내 실제 경험과 다른 숫자·결과를 제목에 넣지 마세요.",
    source: "rule",
  };
}

const REMIX_SYSTEM = `당신은 초보 유튜버의 기획 파트너다. 잘된 레퍼런스 영상의 "구조"를 빌려 사용자의 주제에 맞는
제목과 썸네일 안을 만든다. 사용자는 일과 육아를 병행하는 바쁜 직장인이다.

규칙:
- 레퍼의 문구를 그대로 쓰지 말고, 후킹 구조·썸네일 장치만 가져온다.
- 사용자가 말하지 않은 숫자·결과·경력을 사실처럼 단정하지 않는다. 숫자가 필요하면 [숫자]처럼 자리만 남긴다.
- 낚시성 과장 대신 영상이 실제로 줄 수 있는 것을 약속한다.
- 썸네일 문구는 6자 안팎으로 짧게.
- 출력은 JSON 객체 하나.`;

export async function remixForMe(v: VideoResult, a: Analysis | null, topic: string): Promise<RemixResult> {
  if (getProvider() === "mock") return ruleRemix(v, a, topic);
  const user = `레퍼런스 영상
- 제목: ${v.title}
- 성과: 구독자 대비 ${ratio(v.performanceRatio)}, 채널 평균 대비 ${ratio(v.contributionRatio)}
- 제목 후킹: ${(a?.title.hooks ?? classifyTitle(v.title).hooks).join(", ")}
${a?.thumbnail ? `- 썸네일: 얼굴 ${a.thumbnail.face} / 문구 ${a.thumbnail.text} / 구도 ${a.thumbnail.composition} / 시선 유도 ${a.thumbnail.focus}` : ""}
${a ? `- 가져갈 구조: ${a.steal.join(" / ")}` : ""}

내 영상 주제: ${topic}

아래 JSON으로 답하라.
{
  "titles": [{ "title": "제목 안", "hook": "쓴 후킹 유형", "why": "왜 이 구조가 내 주제에 맞는지 한 문장" }] (정확히 5개),
  "thumbnails": [{ "text": "썸네일 문구", "layout": "구도·표정·색 설명", "why": "한 문장" }] (정확히 3개),
  "caution": "이 주제로 만들 때 조심할 점 한 문장"
}`;
  const raw = await visionJSON(REMIX_SYSTEM, user, "");
  const titles = (Array.isArray(raw.titles) ? raw.titles : []).slice(0, 5).map((x: any) => ({
    title: String(x.title ?? ""),
    hook: String(x.hook ?? ""),
    why: String(x.why ?? ""),
  }));
  const thumbnails = (Array.isArray(raw.thumbnails) ? raw.thumbnails : []).slice(0, 3).map((x: any) => ({
    text: String(x.text ?? ""),
    layout: String(x.layout ?? ""),
    why: String(x.why ?? ""),
  }));
  if (!titles.length) return ruleRemix(v, a, topic);
  return { titles, thumbnails, caution: String(raw.caution ?? ""), source: "ai" };
}
