import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, getOpenAI } from "./openai";

/**
 * 여러 AI 엔진에 질문을 자동으로 던지고 원문 응답(+가능하면 인용 링크)을 받아온다.
 *
 * PRD가 ChatGPT 웹 UI 자동화를 금지한 이유(이용약관 위반 소지)는 여기 해당하지 않는다 —
 * 여기서 부르는 건 각 회사가 공식 제공하는 API다. 사람이 브라우저에서 직접 물어보고
 * 붙여넣는 기존 수동 경로(evidence/route.ts)는 그대로 남겨두고, 이건 그 대안이다.
 *
 * 엔진별로 신뢰도가 다르다:
 * - Perplexity는 API 자체가 실시간 웹 검색 결과이고, 응답에 실제 출처 URL이
 *   `citations` 필드로 함께 온다. 4종 중 가장 "진짜 GEO 측정"에 가깝다.
 * - ChatGPT(OpenAI 기본 채팅)·Claude(Anthropic 기본 메시지)는 웹 검색 없이
 *   모델이 학습한 지식만으로 답한다. 브랜드가 최근에 생겼거나 자료가 적으면
 *   당연히 모른다고 답할 수 있다 — 이건 버그가 아니라 이 엔진의 특성이다.
 * - Gemini도 기본 호출은 검색 없이 답한다. 그라운딩(실시간 검색 연동)은
 *   모델·API 버전에 따라 도구 스키마가 달라 여기서는 시도하지 않는다.
 *
 * 이 파일은 이 저장소 밖 실제 벤더 API에 대해 라이브 테스트를 거치지 않았다.
 * 요청/응답 스키마는 각 회사 공식 문서 기준으로 작성했으니, 실제 키로 한 번씩
 * 돌려보고 필요하면 모델명·엔드포인트를 맞춰 조정할 것.
 */

export type EngineName = "ChatGPT" | "Claude" | "Gemini" | "Perplexity";

export const ALL_ENGINES: EngineName[] = ["ChatGPT", "Claude", "Gemini", "Perplexity"];

export interface ProbeResult {
  responseText: string;
  /** 응답 본문과 별개로 API가 구조화된 필드로 돌려준 출처 URL (있으면). */
  citations: string[];
}

/** 키가 없어서 이 엔진을 부를 수 없다는 뜻. 실패(failed)가 아니라 건너뜀(skip)으로 다룬다. */
export class EngineNotConfiguredError extends Error {
  constructor(engine: EngineName) {
    super(`${engine} API 키가 설정되지 않았습니다.`);
    this.name = "EngineNotConfiguredError";
  }
}

/** 자동 수집을 실행하려는 시점에 실제로 부를 수 있는 엔진 목록. */
export function configuredEngines(): EngineName[] {
  const engines: EngineName[] = [];
  if (process.env.OPENAI_API_KEY) engines.push("ChatGPT");
  if (process.env.ANTHROPIC_API_KEY) engines.push("Claude");
  if (process.env.GEMINI_API_KEY) engines.push("Gemini");
  if (process.env.PERPLEXITY_API_KEY) engines.push("Perplexity");
  return engines;
}

const PROBE_SYSTEM_PROMPT =
  "당신은 일반 사용자의 질문에 답하는 범용 AI 비서다. 실제 사용자가 검색하듯 묻는 질문이니, " +
  "특정 브랜드를 편애하거나 일부러 배제하지 말고 아는 대로 자연스럽게 답하라. 모르면 모른다고 답하라.";

export async function probeEngine(engine: EngineName, queryText: string): Promise<ProbeResult> {
  switch (engine) {
    case "ChatGPT":
      return probeOpenAI(queryText);
    case "Claude":
      return probeAnthropic(queryText);
    case "Gemini":
      return probeGemini(queryText);
    case "Perplexity":
      return probePerplexity(queryText);
  }
}

async function probeOpenAI(queryText: string): Promise<ProbeResult> {
  if (!process.env.OPENAI_API_KEY) throw new EngineNotConfiguredError("ChatGPT");
  const model = process.env.OPENAI_PROBE_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const completion = await getOpenAI().chat.completions.create({
    model,
    temperature: 0.7,
    messages: [
      { role: "system", content: PROBE_SYSTEM_PROMPT },
      { role: "user", content: queryText },
    ],
  });
  return { responseText: completion.choices[0]?.message?.content ?? "", citations: [] };
}

async function probeAnthropic(queryText: string): Promise<ProbeResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new EngineNotConfiguredError("Claude");
  const model = process.env.ANTHROPIC_PROBE_MODEL || process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const message = await getAnthropic().messages.create({
    model,
    max_tokens: 1024,
    system: PROBE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: queryText }],
  });
  const text = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return { responseText: text, citations: [] };
}

async function probePerplexity(queryText: string): Promise<ProbeResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new EngineNotConfiguredError("Perplexity");
  const model = process.env.PERPLEXITY_MODEL || "sonar";

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: PROBE_SYSTEM_PROMPT },
        { role: "user", content: queryText },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Perplexity API 오류 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    citations?: string[];
  };
  return {
    responseText: data.choices?.[0]?.message?.content ?? "",
    citations: Array.isArray(data.citations) ? data.citations : [],
  };
}

async function probeGemini(queryText: string): Promise<ProbeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new EngineNotConfiguredError("Gemini");
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PROBE_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: queryText }] }],
      }),
    }
  );
  if (!res.ok) {
    throw new Error(`Gemini API 오류 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    candidates?: {
      content?: { parts?: { text?: string }[] };
      groundingMetadata?: { groundingChunks?: { web?: { uri?: string } }[] };
    }[];
  };
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const citations = (candidate?.groundingMetadata?.groundingChunks ?? [])
    .map((c) => c.web?.uri)
    .filter((u): u is string => !!u);
  return { responseText: text, citations };
}
