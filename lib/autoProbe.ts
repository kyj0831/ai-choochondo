import { addEvidence, getProject, listFacts, updateEvidenceJudgment } from "./repo";
import { judgeEvidence } from "./llm";
import { configuredEngines, probeEngine, EngineName } from "./engines";
import { describeLlmError } from "./openai";
import { QueryRow, QueryType } from "./types";

export interface ProbeOutcome {
  engine: EngineName;
  /**
   * collected: 답변 수집 + 판정까지 성공.
   * collected_unjudged: 답변은 받았지만 판정(채점) 단계에서 오류 — 증거는 남아 있으니
   *   나중에 다시 판정을 시도할 수 있다. 수동 제출 경로(evidence/route.ts)와 같은 처리.
   * failed: 답변 수집 자체가 실패(키 오류·요금 소진·엔진 쪽 오류 등).
   */
  status: "collected" | "collected_unjudged" | "failed";
  warning?: string;
}

/**
 * 설정된 모든 엔진(API 키가 있는 것만)에 질문 하나를 동시에 던지고,
 * 답변을 증거로 저장한 뒤 판정까지 실행한다.
 *
 * 엔진 하나가 실패해도(요금 소진·네트워크 오류 등) 나머지 엔진은 계속 진행된다 —
 * Promise.allSettled로 서로 격리했다.
 */
export async function runAutoProbeForQuery(projectId: string, query: QueryRow): Promise<ProbeOutcome[]> {
  const project = getProject(projectId);
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

  const engines = configuredEngines();
  const facts = listFacts(projectId)
    .filter((f) => f.approved)
    .map((f) => ({ field: f.field, value: f.value }));

  const settled = await Promise.allSettled(
    engines.map(async (engine): Promise<ProbeOutcome> => {
      const probe = await probeEngine(engine, query.text);

      const evidence = addEvidence({
        project_id: projectId,
        query_id: query.id,
        engine_label: engine,
        response_text: probe.responseText,
        status: "collected",
      });

      try {
        const judgment = await judgeEvidence({
          brandName: project.brand_name,
          aliases: [],
          queryText: query.text,
          queryType: query.type as QueryType,
          responseText: probe.responseText,
          groundTruth: facts,
        });
        // 응답 본문에서 뽑은 인용과, API가 구조화된 필드로 별도로 준 인용(Perplexity의
        // citations, 그라운딩된 Gemini의 groundingChunks)을 합친다.
        const mergedCitations = Array.from(new Set([...(judgment.citations || []), ...probe.citations]));
        updateEvidenceJudgment(evidence.id, { ...judgment, citations: mergedCitations });
        return { engine, status: "collected" };
      } catch (e) {
        // 판정 실패는 수집 실패와 다르다 — 원문 답변은 이미 저장돼 있다.
        return { engine, status: "collected_unjudged", warning: describeLlmError(e) };
      }
    })
  );

  return settled.map((r, i) =>
    r.status === "fulfilled" ? r.value : { engine: engines[i], status: "failed", warning: describeLlmError(r.reason) }
  );
}
