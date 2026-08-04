/**
 * AI 크롤러 식별.
 *
 * 허브 페이지를 우리가 직접 서빙하기 때문에, 어떤 AI 사업자의 봇이 언제 이 브랜드의
 * 공식 정보를 읽어갔는지 직접 관측할 수 있다. 진단이 "AI가 당신을 어떻게 말하는가"를
 * 본다면, 이 로그는 "AI가 당신 정보를 실제로 가져갔는가"를 본다.
 *
 * 주의: User-Agent는 위조 가능하므로 이 기록은 '보장'이 아니라 '관측치'다.
 * 화면에도 그렇게 표기한다.
 */

export interface BotSignature {
  key: string;
  label: string;
  operator: string;
  /** 학습용 수집인지, 사용자 질의 시점의 실시간 조회인지 구분 */
  purpose: "training" | "live_retrieval" | "search_index";
  match: RegExp;
}

export const BOT_SIGNATURES: BotSignature[] = [
  // OpenAI
  { key: "gptbot", label: "GPTBot", operator: "OpenAI", purpose: "training", match: /GPTBot/i },
  { key: "oai-searchbot", label: "OAI-SearchBot", operator: "OpenAI", purpose: "search_index", match: /OAI-SearchBot/i },
  { key: "chatgpt-user", label: "ChatGPT-User", operator: "OpenAI", purpose: "live_retrieval", match: /ChatGPT-User/i },

  // Anthropic
  { key: "claudebot", label: "ClaudeBot", operator: "Anthropic", purpose: "training", match: /ClaudeBot/i },
  { key: "claude-web", label: "Claude-Web", operator: "Anthropic", purpose: "live_retrieval", match: /Claude-Web/i },
  { key: "claude-user", label: "Claude-User", operator: "Anthropic", purpose: "live_retrieval", match: /Claude-User/i },
  { key: "anthropic-ai", label: "anthropic-ai", operator: "Anthropic", purpose: "training", match: /anthropic-ai/i },

  // Google
  { key: "google-extended", label: "Google-Extended", operator: "Google", purpose: "training", match: /Google-Extended/i },
  { key: "googleother", label: "GoogleOther", operator: "Google", purpose: "search_index", match: /GoogleOther/i },

  // Perplexity
  { key: "perplexitybot", label: "PerplexityBot", operator: "Perplexity", purpose: "search_index", match: /PerplexityBot/i },
  { key: "perplexity-user", label: "Perplexity-User", operator: "Perplexity", purpose: "live_retrieval", match: /Perplexity-User/i },

  // 그 외
  { key: "bingbot", label: "BingBot", operator: "Microsoft", purpose: "search_index", match: /bingbot/i },
  { key: "applebot-extended", label: "Applebot-Extended", operator: "Apple", purpose: "training", match: /Applebot-Extended/i },
  { key: "applebot", label: "Applebot", operator: "Apple", purpose: "search_index", match: /Applebot/i },
  { key: "meta-externalagent", label: "meta-externalagent", operator: "Meta", purpose: "training", match: /meta-externalagent/i },
  { key: "bytespider", label: "Bytespider", operator: "ByteDance", purpose: "training", match: /Bytespider/i },
  { key: "amazonbot", label: "Amazonbot", operator: "Amazon", purpose: "training", match: /Amazonbot/i },
  { key: "cohere-ai", label: "cohere-ai", operator: "Cohere", purpose: "training", match: /cohere-(ai|training-data-crawler)/i },
  { key: "youbot", label: "YouBot", operator: "You.com", purpose: "search_index", match: /YouBot/i },
  { key: "naver-yeti", label: "Yeti", operator: "Naver", purpose: "search_index", match: /Yeti/i },
  { key: "daum", label: "Daum", operator: "Kakao", purpose: "search_index", match: /Daumoa|Daum\b/i },
];

export function identifyBot(userAgent: string | null): BotSignature | null {
  if (!userAgent) return null;
  return BOT_SIGNATURES.find((b) => b.match.test(userAgent)) ?? null;
}

export const PURPOSE_LABEL: Record<BotSignature["purpose"], string> = {
  training: "학습 데이터 수집",
  live_retrieval: "사용자 질문 시점 실시간 조회",
  search_index: "AI 검색 색인",
};

/**
 * robots.txt 본문.
 * 일반 SEO와 반대로, 여기서는 AI 크롤러를 명시적으로 '허용'하는 것이 목적이다.
 * 허브는 AI에게 읽히라고 만든 페이지이기 때문이다.
 */
export function buildRobotsTxt(baseUrl: string): string {
  const allowAll = BOT_SIGNATURES.map((b) => `User-agent: ${b.label}\nAllow: /p/\n`).join("\n");
  return `# AI 추천도 진단 — AI 프로필 허브
# 허브(/p/*)는 AI가 브랜드의 공식 정보를 정확히 읽어가도록 만든 페이지입니다.
# 아래 크롤러의 접근을 명시적으로 허용합니다.

${allowAll}
User-agent: *
Allow: /p/
Disallow: /api/
Disallow: /projects/
Disallow: /new

Sitemap: ${baseUrl}/sitemap.xml
`;
}
