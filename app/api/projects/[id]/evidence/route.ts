import { NextRequest, NextResponse } from "next/server";
import { addEvidence, getProject, listEvidence, listFacts, listQueries, updateEvidenceJudgment, updateProjectStatus } from "@/lib/repo";
import { judgeEvidence } from "@/lib/llm";
import { describeLlmError } from "@/lib/openai";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return NextResponse.json({ evidence: listEvidence(params.id) });
}

// Submit a pasted AI answer as evidence for a query, then judge it (FR-020/021/022/030)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const { query_id, engine_label, response_text, status } = body;
  if (!query_id || !engine_label) {
    return NextResponse.json({ error: "query_id, engine_label은 필수입니다." }, { status: 400 });
  }

  const evidenceStatus: "collected" | "not_found" | "collection_failed" =
    status === "collection_failed" ? "collection_failed" : response_text && response_text.trim() ? "collected" : "not_found";

  const evidence = addEvidence({
    project_id: params.id,
    query_id,
    engine_label,
    response_text: response_text || "",
    status: evidenceStatus,
  });

  if (evidenceStatus === "collected") {
    try {
      const queries = listQueries(params.id);
      const query = queries.find((q) => q.id === query_id);
      const facts = listFacts(params.id);
      const judgment = await judgeEvidence({
        brandName: project.brand_name,
        aliases: [],
        queryText: query?.text || "",
        queryType: (query?.type as any) || "direct",
        responseText: response_text,
        groundTruth: facts.filter((f) => f.approved).map((f) => ({ field: f.field, value: f.value })),
      });
      updateEvidenceJudgment(evidence.id, judgment);
    } catch (e) {
      // Judgment failure shouldn't block evidence submission; leave unjudged, surface error.
      // 원인을 뭉개면 사용자가 고칠 수 없는 문제(키 만료·크레딧 소진 등)를 무한 재시도하게 된다.
      console.error("[evidence] 판정 실패:", e);
      return NextResponse.json({ evidence, warning: describeLlmError(e) });
    }
  }

  updateProjectStatus(params.id, "evidence");
  return NextResponse.json({ evidence: listEvidence(params.id).find((e) => e.id === evidence.id) });
}
