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
/**
 * 401이 났을 때 "왜"까지 화면에서 바로 알 수 있게 저장된 키의 생김새를 진단한다.
 *
 * 비개발자 사용자에게 "키를 확인하세요"는 아무 정보가 아니다. 실제로 겪은
 * 사고는 대부분 붙여넣기 실수였는데, 키 입력이 화면에 보이지 않으니
 * 본인은 알 수가 없다. 그래서 앱이 대신 본다.
 *
 * 키 전체는 절대 노출하지 않는다 — 앞 11자와 뒤 4자만 보여준다. 그 정도면
 * OpenAI 대시보드의 키 목록과 눈으로 대조하기에 충분하다.
 */
function diagnoseKey(): string {
  const isAnthropic = getProvider() === "anthropic";
  const name = isAnthropic ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  const issueUrl = isAnthropic
    ? "https://console.anthropic.com/settings/keys"
    : "https://platform.openai.com/api-keys";
  const key = readApiKey(name);
  if (!key) return `.env.local에 ${name}가 없습니다. '키넣기.command'를 실행하세요.`;

  const masked = `${key.slice(0, 11)}…${key.slice(-4)}`;
  const where = `(저장된 키: ${masked}, 길이 ${key.length}자)`;

  const prefix = isAnthropic ? "sk-ant-" : "sk-";
  const occurrences = key.split(prefix).length - 1;
  if (occurrences > 1) {
    return (
      `${where} 키 안에 '${prefix}'가 ${occurrences}번 들어 있습니다 — 키가 ${occurrences}번 이어붙어 저장됐습니다. ` +
      `키 입력은 화면에 보이지 않아서 Command+V를 여러 번 누르면 이렇게 됩니다. ` +
      `'키넣기.command'를 다시 실행하고 Command+V는 한 번만 누르세요.`
    );
  }
  if (!key.startsWith(prefix)) {
    return `${where} 키가 '${prefix}'로 시작하지 않습니다 — 다른 값이 들어갔습니다. '키넣기.command'로 다시 넣으세요.`;
  }
  if (key.length < 40) {
    return `${where} 키가 너무 짧습니다 — 복사가 중간에 잘렸습니다. '키넣기.command'로 다시 넣으세요.`;
  }
  return (
    `${where} 키 형식 자체는 정상이니, 이 키가 폐기(revoke)됐을 가능성이 높습니다. ` +
    `${issueUrl} 에서 목록의 키와 위 값을 대조해 보고, 없으면 새로 발급받아 '키넣기.command'로 넣으세요.`
  );
}

export function describeLlmError(e: unknown): string {
  const err = e as { status?: number; code?: string; error?: { code?: string }; message?: string };
  const code = err?.code || err?.error?.code || "";
  const status = err?.status;

  if (code === "credit_balance_exhausted" || code === "insufficient_quota") {
    return `${getProvider() === "anthropic" ? "Anthropic" : "OpenAI"} API 크레딧이 소진되어 판정을 실행할 수 없습니다. 결제 잔액을 충전하거나, .env.local에 MOCK_LLM=1을 설정해 데모 모드로 진행하세요.`;
  }
  if (status === 401 || code === "invalid_api_key") {
    return `API 키가 유효하지 않습니다 (401). ${diagnoseKey()}`;
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
