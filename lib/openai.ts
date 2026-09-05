import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// LLM provider layer.
//
// Provider resolution (first match wins):
//   1. MOCK_LLM=1            → mock (deterministic sample responses)
//   2. LLM_PROVIDER env var  → forced ("openai" | "anthropic" | "mock")
//   3. OPENAI_API_KEY set    → openai
//   4. ANTHROPIC_API_KEY set → anthropic
//   5. nothing set           → mock (app still fully works, demo quality)
// ---------------------------------------------------------------------------

export type LLMProvider = "openai" | "anthropic" | "mock";

/**
 * 자리표시자(placeholder)를 진짜 키로 오인하지 않게 거른다.
 *
 * .env.local.example 이 배포되던 시절 `OPENAI_API_KEY=sk-...` 라는 예시 값이
 * 그대로 .env.local 로 복사됐고, 앱은 "키가 있다"고 판단해 실제 호출을 시도하다
 * 401 Incorrect API key 로 죽었다. 사용자 입장에서는 키를 넣은 적도 없는데
 * 에러만 보이는 상황이라, 아예 키가 없는 것으로 취급해 데모 모드로 보낸다.
 */
export function readApiKey(name: string): string | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const v = raw.trim().replace(/^["']|["']$/g, "");
  if (!v) return undefined;
  if (v.includes("...") || v.includes("…")) return undefined;      // sk-... 같은 예시
  if (/^(your|여기|xxx|changeme|placeholder)/i.test(v)) return undefined;
  if (v.length < 20) return undefined;                              // 실제 키는 훨씬 길다
  return v;
}

let warned = false;

export function getProvider(): LLMProvider {
  if (process.env.MOCK_LLM === "1") return "mock";
  const forced = process.env.LLM_PROVIDER;
  if (forced === "openai" || forced === "anthropic" || forced === "mock") return forced;
  if (readApiKey("OPENAI_API_KEY")) return "openai";
  if (readApiKey("ANTHROPIC_API_KEY")) return "anthropic";
  if (!warned) {
    console.warn(
      "[AI 추천도] OPENAI_API_KEY / ANTHROPIC_API_KEY가 없어 데모(목업) 모드로 동작합니다. .env.local에 키를 추가하면 실제 LLM 분석이 활성화됩니다."
    );
    warned = true;
  }
  return "mock";
}

export function isMockMode(): boolean {
  return getProvider() === "mock";
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: readApiKey("OPENAI_API_KEY") });
  return openaiClient;
}

export function getAnthropic(): Anthropic {
  // Zero-arg constructor also resolves ANTHROPIC_AUTH_TOKEN or an
  // `ant auth login` profile if present on the machine.
  if (!anthropicClient) {
    const key = readApiKey("ANTHROPIC_API_KEY");
    anthropicClient = key ? new Anthropic({ apiKey: key }) : new Anthropic();
  }
  return anthropicClient;
}

/**
 * LLM 호출 실패 원인을 사용자가 조치 가능한 문장으로 바꾼다.
 * 크레딧 소진·키 오류처럼 재시도로 해결되지 않는 문제를 "다시 시도해주세요"로
 * 뭉개면 사용자가 원인을 알 수 없어 무한 재시도하게 된다.
 */
export function describeLlmError(e: unknown): string {
  const err = e as { status?: number; code?: string; error?: { code?: string }; message?: string };
  const code = err?.code || err?.error?.code || "";
  const status = err?.status;

  if (code === "credit_balance_exhausted" || code === "insufficient_quota") {
    return `${getProvider() === "anthropic" ? "Anthropic" : "OpenAI"} API 크레딧이 소진되어 판정을 실행할 수 없습니다. 결제 잔액을 충전하거나, .env.local에 MOCK_LLM=1을 설정해 데모 모드로 진행하세요.`;
  }
  if (status === 401 || code === "invalid_api_key") {
    return "API 키가 유효하지 않습니다. .env.local의 키를 확인하세요.";
  }
  if (status === 429) {
    return "API 호출 한도(rate limit)에 걸렸습니다. 잠시 후 다시 시도하세요.";
  }
  if (status === 404 || code === "model_not_found") {
    return "지정한 모델을 사용할 수 없습니다. .env.local의 OPENAI_MODEL / ANTHROPIC_MODEL을 확인하세요.";
  }
  if (err?.message?.includes("JSON")) {
    return "LLM 응답을 JSON으로 해석하지 못했습니다. 다시 시도해주세요.";
  }
  return `판정 중 오류가 발생했습니다: ${err?.message ?? "알 수 없는 오류"}`;
}

// Claude responses may wrap JSON in markdown fences; extract the first JSON object.
function extractJSON(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM 응답에서 JSON을 찾을 수 없습니다.");
  }
  return candidate.slice(start, end + 1);
}

export async function callJSON<T>(system: string, user: string): Promise<T> {
  const provider = getProvider();

  if (provider === "openai") {
    const completion = await getOpenAI().chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("LLM 응답이 비어 있습니다.");
    return JSON.parse(content) as T;
  }

  if (provider === "anthropic") {
    const message = await getAnthropic().messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      system,
      messages: [
        { role: "user", content: `${user}\n\n반드시 유효한 JSON 객체 하나만 출력하세요. 다른 텍스트를 붙이지 마세요.` },
      ],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text) throw new Error("LLM 응답이 비어 있습니다.");
    return JSON.parse(extractJSON(text)) as T;
  }

  throw new Error("mock 모드에서는 callJSON이 호출되지 않아야 합니다.");
}
