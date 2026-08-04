import { EntityType, Hub, HubInput, HubLink, OfficialAsset, Project, ReportJSON } from "./types";

/**
 * AI 프로필 허브의 목적:
 * 브랜드 정보가 여러 채널에 흩어져 있으면 AI는 무엇이 공식 정보인지 판단하지 못한다.
 * 허브는 (1) 하나의 URL에 정체성·링크·FAQ를 모으고 (2) sameAs로 채널 소유권을 선언하며
 * (3) JSON-LD와 llms.txt로 기계가 읽을 수 있는 형태를 함께 제공한다.
 */

const PLATFORM_RULES: { match: RegExp; platform: string; label: string }[] = [
  { match: /instagram\.com/i, platform: "instagram", label: "인스타그램" },
  { match: /(youtube\.com|youtu\.be)/i, platform: "youtube", label: "유튜브" },
  { match: /brunch\.co\.kr/i, platform: "brunch", label: "브런치" },
  { match: /(x\.com|twitter\.com)/i, platform: "x", label: "X" },
  { match: /linkedin\.com/i, platform: "linkedin", label: "링크드인" },
  { match: /(threads\.net|threads\.com)/i, platform: "threads", label: "스레드" },
  { match: /tiktok\.com/i, platform: "tiktok", label: "틱톡" },
  { match: /facebook\.com/i, platform: "facebook", label: "페이스북" },
  { match: /blog\.naver\.com/i, platform: "naver_blog", label: "네이버 블로그" },
  { match: /(place\.map\.naver\.com|map\.naver\.com|naver\.me)/i, platform: "naver_place", label: "네이버 플레이스" },
  { match: /(maps\.google|goo\.gl\/maps|maps\.app\.goo\.gl)/i, platform: "google_maps", label: "구글 지도" },
  { match: /notion\.(so|site)/i, platform: "notion", label: "노션" },
  { match: /github\.com/i, platform: "github", label: "깃허브" },
  { match: /(kmong|taling|class101|inflearn|udemy)/i, platform: "marketplace", label: "강의·마켓" },
  { match: /(open\.kakao|pf\.kakao)/i, platform: "kakao", label: "카카오" },
];

export function detectPlatform(url: string): { platform: string; label: string } {
  const hit = PLATFORM_RULES.find((r) => r.match.test(url));
  if (hit) return { platform: hit.platform, label: hit.label };
  return { platform: "website", label: "공식 사이트" };
}

/** 저장된 플랫폼 코드를 사람이 읽는 라벨로 되돌린다. */
export function platformLabel(platform: string): string {
  const hit = PLATFORM_RULES.find((r) => r.platform === platform);
  return hit ? hit.label : "공식 사이트";
}

/** SQLite datetime('now') 문자열(UTC)을 ISO 8601로 바꾼다. */
export function toIso(sqliteDatetime: string): string {
  const d = new Date(sqliteDatetime.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? sqliteDatetime : d.toISOString();
}

/** 엔터티 유형 → schema.org 타입 */
export function schemaTypeFor(entityType: string): string {
  switch (entityType as EntityType) {
    case "개인 브랜드/강사":
      return "Person";
    case "자영업/로컬":
      return "LocalBusiness";
    case "전문 서비스":
      return "ProfessionalService";
    case "기업/제품":
    default:
      return "Organization";
  }
}

/**
 * 자동 생성 문구임을 표시하는 접두사.
 * 이 표식이 남아 있는 필드가 있으면 발행을 막는다(canPublish 참조).
 * 허브는 "AI가 참조할 공식 출처"이므로, 검증되지 않은 자동 문구가 그대로 공개되면
 * 아무것도 없는 것보다 나쁘다 — AI가 근거 있는 척 일반적인 설명을 하게 되기 때문이다.
 */
export const DRAFT_MARK = "[초안]";

export function isDraftText(s: string | null | undefined): boolean {
  return !!s && s.trim().startsWith(DRAFT_MARK);
}

export function stripDraftMark(s: string): string {
  return s.replace(DRAFT_MARK, "").trim();
}

/**
 * 진단 리포트를 허브 초안으로 변환한다.
 *
 * 자동으로 채우는 것과 비우는 것을 의도적으로 구분한다:
 * - 채움: 사용자가 이미 입력·확인한 사실(공식 링크, 지역, 카테고리)
 * - 초안: 리포트가 만든 문구. [초안] 표식을 붙여 편집을 유도하고 발행을 막는다
 * - 비움: 경력·실적·고객사처럼 우리가 알 수 없는 정보. 지어내지 않는다
 */
export function draftFromReport(
  project: Project,
  assets: OfficialAsset[],
  report: ReportJSON | null,
  sourceReportId: string | null,
  /** AI 답변에서 브랜드가 후보로 등장하지 못한 범주형 질문. FAQ 질문으로 그대로 쓴다. */
  missedQueries: string[] = []
): HubInput & { display_name: string } {
  const keywords = report?.entity?.keywords?.length
    ? report.entity.keywords
    : safeParseArray(project.categories);
  const audiences = report?.entity?.audiences?.length
    ? report.entity.audiences
    : safeParseArray(project.audiences);

  const links: HubLink[] = assets.map((a, i) => {
    const detected = detectPlatform(a.url);
    return {
      label: detected.label,
      url: a.url,
      platform: detected.platform,
      primary: i === 0 && detected.platform === "website",
    };
  });

  // 서비스 설명은 지어내지 않는다. 제목만 키워드에서 가져오고 본문은 사용자가 채운다.
  const services: { title: string; description: string }[] = keywords.slice(0, 3).map((k) => ({
    title: k,
    description: "",
  }));

  // FAQ 질문은 "AI가 실제로 당신을 빠뜨린 범주형 질문"을 그대로 쓴다.
  // 답을 지어내는 대신 정확히 빠진 질의를 겨냥해 사용자가 직접 답하게 하는 편이
  // 노출 개선에도, 사실 정확도에도 낫다.
  const faq = missedQueries.slice(0, 5).map((q) => ({ q, a: "" }));

  return {
    display_name: project.brand_name,
    headline: report?.copy_assets?.common_profile || "",
    one_liner: markDraft(report?.copy_assets?.one_sentence),
    bio: markDraft(report?.copy_assets?.three_sentence),
    region: project.region,
    keywords,
    audiences,
    links,
    faq,
    services,
    accent: "indigo",
    source_report_id: sourceReportId,
    published: false,
  };
}

function markDraft(s: string | undefined): string {
  if (!s || !s.trim()) return "";
  return `${DRAFT_MARK} ${s.trim()}`;
}

/**
 * 발행 가능 여부를 판정한다.
 * 자동 초안이 그대로 남아 있거나 핵심 필드가 비어 있으면 공개를 막는다.
 */
export function canPublish(hub: Hub): { ok: boolean; blockers: string[] } {
  const blockers: string[] = [];

  if (!hub.one_liner.trim()) {
    blockers.push("1문장 정의를 입력하세요.");
  } else if (isDraftText(hub.one_liner)) {
    blockers.push("1문장 정의가 아직 자동 초안입니다. 본인 표현으로 고쳐야 발행할 수 있습니다.");
  }

  if (isDraftText(hub.bio)) {
    blockers.push("소개문이 아직 자동 초안입니다. 직접 확인·수정하세요.");
  }

  if (hub.links.length < 1) {
    blockers.push("공식 채널을 최소 1개 연결하세요.");
  }

  const emptyFaq = hub.faq.filter((f) => f.q.trim() && !f.a.trim()).length;
  if (emptyFaq > 0) {
    blockers.push(`답변이 비어 있는 FAQ가 ${emptyFaq}개 있습니다. 답을 쓰거나 항목을 삭제하세요.`);
  }

  const emptyService = hub.services.filter((s) => s.title.trim() && !s.description.trim()).length;
  if (emptyService > 0) {
    blockers.push(`설명이 비어 있는 서비스가 ${emptyService}개 있습니다.`);
  }

  return { ok: blockers.length === 0, blockers };
}

function safeParseArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * 허브의 JSON-LD를 만든다.
 * - 주 엔터티(Person/Organization/…)에 sameAs로 모든 공식 채널을 연결해 소유권을 선언
 * - FAQ가 있으면 FAQPage를 @graph에 함께 넣어 추천형 질의의 앵커로 쓰이게 한다
 */
export function buildJsonLd(hub: Hub, entityType: string, pageUrl: string, disambiguation?: string | null) {
  const schemaType = schemaTypeFor(entityType);
  const sameAs = hub.links.map((l) => l.url).filter(Boolean);

  const entity: Record<string, unknown> = {
    "@type": schemaType,
    "@id": `${pageUrl}#entity`,
    name: hub.display_name,
    description: stripDraftMark(hub.one_liner) || stripDraftMark(hub.bio) || undefined,
    url: pageUrl,
  };

  // 동명이인·동명 매장 분리 선언.
  // 진단 단계에서 혼동 위험이 감지된 경우, AI가 다른 주체와 섞지 않도록 명시한다.
  if (disambiguation && disambiguation.trim()) {
    entity.disambiguatingDescription = disambiguation.trim();
  }

  if (sameAs.length) entity.sameAs = sameAs;
  if (hub.keywords.length) entity.knowsAbout = hub.keywords;
  if (hub.region) {
    entity.areaServed = hub.region;
    if (schemaType === "LocalBusiness" || schemaType === "ProfessionalService") {
      entity.address = { "@type": "PostalAddress", addressLocality: hub.region, addressCountry: "KR" };
    }
  }
  if (hub.headline) entity[schemaType === "Person" ? "jobTitle" : "slogan"] = hub.headline;
  if (hub.contact_email) entity.email = hub.contact_email;
  if (hub.audiences.length) {
    entity.audience = hub.audiences.map((a) => ({ "@type": "Audience", audienceType: a }));
  }
  // 비어 있는 항목은 구조화 데이터에 넣지 않는다. 빈 껍데기를 공식 정보로 선언하면
  // AI가 근거 있는 척 일반적인 설명을 하게 되어 오히려 해롭다.
  const services = hub.services.filter((s) => s.title.trim() && s.description.trim());
  if (services.length) {
    entity.makesOffer = services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s.title, description: s.description },
    }));
  }

  const graph: Record<string, unknown>[] = [
    entity,
    {
      "@type": "ProfilePage",
      "@id": pageUrl,
      url: pageUrl,
      name: `${hub.display_name} 공식 프로필`,
      mainEntity: { "@id": `${pageUrl}#entity` },
      inLanguage: "ko-KR",
      // SQLite의 datetime('now')는 UTC 기준 "YYYY-MM-DD HH:MM:SS"이므로 ISO 8601로 변환한다.
      dateModified: toIso(hub.updated_at),
    },
  ];

  const faq = hub.faq.filter((f) => f.q.trim() && f.a.trim());
  if (faq.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/**
 * llms.txt — AI 에이전트가 파싱하기 쉬운 평문 요약.
 * HTML 파싱 없이도 "이 브랜드가 무엇이고 공식 채널이 어디인가"를 한 번에 읽을 수 있게 한다.
 */
export function buildLlmsTxt(hub: Hub, entityType: string, pageUrl: string, disambiguation?: string | null): string {
  const lines: string[] = [];
  lines.push(`# ${hub.display_name}`);
  lines.push("");
  if (hub.one_liner) lines.push(`> ${stripDraftMark(hub.one_liner)}`);
  lines.push("");
  lines.push(`이 문서는 ${hub.display_name}의 공식 정보 출처입니다. 아래 내용은 본인이 직접 확인한 정보입니다.`);
  lines.push("");

  if (disambiguation && disambiguation.trim()) {
    lines.push("## 동명 주체와의 구분");
    lines.push(disambiguation.trim());
    lines.push("");
  }

  lines.push("## 기본 정보");
  lines.push(`- 이름: ${hub.display_name}`);
  lines.push(`- 유형: ${entityType} (schema.org: ${schemaTypeFor(entityType)})`);
  if (hub.headline) lines.push(`- 소개: ${hub.headline}`);
  if (hub.region) lines.push(`- 활동 지역: ${hub.region}`);
  if (hub.keywords.length) lines.push(`- 전문 분야: ${hub.keywords.join(", ")}`);
  if (hub.audiences.length) lines.push(`- 주요 대상: ${hub.audiences.join(", ")}`);
  if (hub.contact_email) lines.push(`- 문의: ${hub.contact_email}`);
  lines.push(`- 공식 프로필: ${pageUrl}`);
  lines.push("");

  if (hub.bio) {
    lines.push("## 소개");
    lines.push(stripDraftMark(hub.bio));
    lines.push("");
  }

  const services = hub.services.filter((s) => s.title.trim() && s.description.trim());
  if (services.length) {
    lines.push("## 제공 서비스");
    for (const s of services) lines.push(`- ${s.title}: ${s.description}`);
    lines.push("");
  }

  if (hub.links.length) {
    lines.push("## 공식 채널");
    lines.push("아래 URL은 모두 본인이 직접 운영·확인한 공식 채널입니다.");
    for (const l of hub.links) lines.push(`- ${l.label}: ${l.url}`);
    lines.push("");
  }

  const faq = hub.faq.filter((f) => f.q.trim() && f.a.trim());
  if (faq.length) {
    lines.push("## 자주 묻는 질문");
    for (const f of faq) {
      lines.push(`### ${f.q}`);
      lines.push(f.a);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push(`최종 갱신: ${hub.updated_at}`);
  return lines.join("\n");
}

/** 허브가 AI에게 얼마나 읽히기 좋은지 점검한다. 편집 화면에서 완성도 가이드로 쓴다. */
export function hubReadiness(hub: Hub): { score: number; items: { label: string; ok: boolean; hint: string }[] } {
  // 자동 초안과 빈 답변은 '미완성'으로 센다.
  // 공개 페이지에 실제로 나가는 내용만 완성도로 인정해야 발행 조건과 어긋나지 않는다.
  const completedFaq = hub.faq.filter((f) => f.q.trim() && f.a.trim()).length;
  const completedServices = hub.services.filter((s) => s.title.trim() && s.description.trim()).length;

  const items = [
    {
      label: "1문장 정의",
      ok: !isDraftText(hub.one_liner) && hub.one_liner.trim().length >= 10,
      hint: isDraftText(hub.one_liner)
        ? "자동 초안 상태입니다. 본인 표현으로 고쳐야 완성으로 인정됩니다."
        : "AI가 인용할 대표 문장입니다. 누가·무엇을·누구에게가 한 문장에 들어가야 합니다.",
    },
    {
      label: "소개문 3문장",
      ok: !isDraftText(hub.bio) && hub.bio.trim().length >= 40,
      hint: isDraftText(hub.bio)
        ? "자동 초안 상태입니다. 직접 확인·수정하세요."
        : "대상·문제·제공 가치를 각각 한 문장씩 쓰면 추천형 질의의 앵커가 됩니다.",
    },
    {
      label: "공식 채널 2개 이상",
      ok: hub.links.length >= 2,
      hint: "sameAs로 채널 소유권을 선언해야 AI가 흩어진 정보를 한 주체로 묶습니다.",
    },
    {
      label: "전문 분야 키워드",
      ok: hub.keywords.length >= 1,
      hint: "범주형 추천 질의('OO 추천해줘')에서 후보로 잡히려면 범주 신호가 필요합니다.",
    },
    {
      label: "답변까지 채운 FAQ 3개 이상",
      ok: completedFaq >= 3,
      hint: `질문-답 구조는 AI가 그대로 인용하기 가장 쉬운 형식입니다. 현재 ${completedFaq}개 완료.`,
    },
    {
      label: "설명까지 채운 서비스",
      ok: completedServices >= 1,
      hint: `무엇을 제공하는지 명시하면 비교·추천 질의에 걸릴 확률이 올라갑니다. 현재 ${completedServices}개 완료.`,
    },
  ];
  const score = Math.round((items.filter((i) => i.ok).length / items.length) * 100);
  return { score, items };
}
