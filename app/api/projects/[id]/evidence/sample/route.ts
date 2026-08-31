import { NextRequest, NextResponse } from "next/server";
import { addEvidence, getProject, listEvidence, listQueries, updateEvidenceJudgment, updateProjectStatus } from "@/lib/repo";
import { QueryRow } from "@/lib/types";

// 시연·체험용: 모든 질문에 그럴듯한 샘플 답변과 판정을 한 번에 채운다.
// LLM을 호출하지 않고 결정적으로 생성하므로 즉시·무료이며, PRD의 대표 패턴
// ("이름 검색은 되지만 범주형 추천에서는 약함")을 재현한다.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const brand = project.brand_name;
  const categories: string[] = JSON.parse(project.categories);
  const cat = categories[0] || "전문 분야";
  const queries = listQueries(params.id);
  const existing = listEvidence(params.id);
  const alreadyHas = new Set(existing.map((e) => e.query_id));

  const targets = queries.filter((q) => !alreadyHas.has(q.id));
  if (targets.length === 0) {
    return NextResponse.json({ filled: 0, message: "이미 모든 질문에 증거가 있습니다." });
  }

  const engines = ["ChatGPT", "Perplexity", "Gemini"];
  let recommendCount = 0;

  targets.forEach((q, idx) => {
    const engine = engines[idx % engines.length];
    const { text, judgment } = sampleFor(q, brand, cat, recommendCount);
    if (judgment.mention_type === "recommended_candidate") recommendCount++;

    const ev = addEvidence({
      project_id: params.id,
      query_id: q.id,
      engine_label: engine,
      response_text: text,
      status: "collected",
      is_sample: true,
    });
    updateEvidenceJudgment(ev.id, judgment);
  });

  updateProjectStatus(params.id, "evidence");
  return NextResponse.json({ filled: targets.length });
}

interface SampleJudgment {
  entity_found: boolean;
  mention_type: "recommended_candidate" | "simple_mention" | "not_found";
  position: number | null;
  description_accuracy: number;
  conflicts: string[];
  source_types: string[];
  citations: string[];
  confidence: number;
}

function sampleFor(
  q: QueryRow,
  brand: string,
  cat: string,
  recommendSoFar: number
): { text: string; judgment: SampleJudgment } {
  // 직접 검색: 잘 노출됨 (공식 출처 동반)
  if (q.type === "direct") {
    return {
      text: `${brand}는 ${cat} 분야에서 활동 중이며, 공식 사이트와 SNS에서 관련 정보를 확인할 수 있습니다.`,
      judgment: {
        entity_found: true,
        mention_type: "simple_mention",
        position: null,
        description_accuracy: 0.85,
        conflicts: [],
        source_types: ["official_site", "official_sns"],
        citations: [],
        confidence: 0.8,
      },
    };
  }

  // 설명 검증: 대체로 정확하나 하나쯤 과거 정보 충돌
  if (q.type === "explain") {
    const stale = /최근 활동|실적/.test(q.text);
    return {
      text: stale
        ? `${brand}의 활동 이력이 일부 확인되나, 최신 정보는 제한적입니다.`
        : `${brand}는 ${cat}를 중심으로 활동합니다.`,
      judgment: {
        entity_found: true,
        mention_type: "simple_mention",
        position: null,
        description_accuracy: stale ? 0.6 : 0.85,
        conflicts: stale ? ["과거 정보로 보이는 표현이 있어 최신성 보강이 필요"] : [],
        source_types: ["official_site"],
        citations: [],
        confidence: 0.75,
      },
    };
  }

  // 범주형 추천/지역·상황/비교: 처음 2건만 추천 포함, 나머지는 미노출
  // → "이름은 나오지만 추천은 약함" 패턴 재현
  const included = recommendSoFar < 2;
  if (included) {
    return {
      text: `${cat} 분야에서는 여러 곳이 있으며, 대표적으로 ${brand}를 추천할 수 있습니다. 실무 중심의 강점이 있습니다.`,
      judgment: {
        entity_found: true,
        mention_type: "recommended_candidate",
        position: 2,
        description_accuracy: 0.8,
        conflicts: [],
        source_types: ["official_site", "news_media"],
        citations: [],
        confidence: 0.78,
      },
    };
  }
  return {
    text: `${cat} 관련해서는 여러 업체·전문가가 있으나 특정 한 곳을 특정하기는 어렵습니다. 몇 곳을 비교해 보시길 권합니다.`,
    judgment: {
      entity_found: false,
      mention_type: "not_found",
      position: null,
      description_accuracy: 0,
      conflicts: [],
      source_types: ["unknown"],
      citations: [],
      confidence: 0.5,
    },
  };
}
