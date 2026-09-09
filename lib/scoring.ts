import { AxisScore, EvidenceRow, QueryRow, SourceType } from "./types";

const OFFICIAL_TYPES: SourceType[] = ["official_site", "official_sns"];
const THIRD_PARTY_AUTHORITY_TYPES: SourceType[] = ["news_media", "institution", "author_profile"];

function safeParseArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface ScoringInput {
  queries: QueryRow[];
  evidence: EvidenceRow[];
  officialAssetCount: number;
  hasStructuredData: boolean;
  lastActivityWithinDays: number | null; // days since most recent activity claim, from ground truth
  hasSameNameConflictFlag: boolean;
}

export interface ScoringResult {
  axes: AxisScore[];
  total: number;
  grade: string;
  gradeLabel: string;
  sampleSize: number;
  engineCount: number;
  failureRate: number;
  trustBadge: "high" | "medium" | "low";
  trustLabel: string;
}

function evidenceForType(evidence: EvidenceRow[], queries: QueryRow[], type: string) {
  const qIds = new Set(queries.filter((q) => q.type === type).map((q) => q.id));
  return evidence.filter((e) => qIds.has(e.query_id));
}

function usableEvidence(list: EvidenceRow[]) {
  return list.filter((e) => e.status === "collected" && e.judged_at);
}

export function computeScores(input: ScoringInput): ScoringResult {
  const { queries, evidence, officialAssetCount, hasStructuredData, lastActivityWithinDays, hasSameNameConflictFlag } = input;

  const directQ = queries.filter((q) => q.type === "direct");
  const recommendQ = queries.filter((q) => q.type === "recommend" || q.type === "situational");
  const directEv = usableEvidence(evidenceForType(evidence, queries, "direct"));
  const recommendEv = usableEvidence(
    evidence.filter((e) => {
      const q = queries.find((qq) => qq.id === e.query_id);
      return q && (q.type === "recommend" || q.type === "situational") && e.status === "collected" && e.judged_at;
    })
  );
  const allUsable = usableEvidence(evidence);

  // ---- A. 직접 검색 가시성 (20) ----
  const directFoundRate = directEv.length ? directEv.filter((e) => e.entity_found === 1).length / directEv.length : 0;
  const directExposureScore = directFoundRate * 10;

  const directOfficialAccompanyRate = directEv.length
    ? directEv.filter((e) => safeParseArray(e.source_types).some((t) => OFFICIAL_TYPES.includes(t as SourceType))).length /
      directEv.length
    : 0;
  const officialAccompanyScore = directOfficialAccompanyRate * 6;

  const confusionFlags = directEv.filter((e) => safeParseArray(e.conflicts).some((c) => /동명이인|혼동|다른 사람|다른 매장/.test(c)));
  let confusionScore = 4;
  if (hasSameNameConflictFlag) confusionScore -= 1.5;
  if (directEv.length) confusionScore -= (confusionFlags.length / directEv.length) * 4;
  confusionScore = clamp(confusionScore, 0, 4);

  const axisA: AxisScore = {
    axis: "direct",
    label: "직접 검색 가시성",
    max: 20,
    raw: round1(directExposureScore + officialAccompanyScore + confusionScore),
    breakdown: [
      { label: "직접 질의 노출률", max: 10, value: round1(directExposureScore) },
      { label: "공식 채널 동반 노출", max: 6, value: round1(officialAccompanyScore) },
      { label: "동명이인 혼동 방지", max: 4, value: round1(confusionScore) },
    ],
    judgment: directFoundRate >= 0.9 ? "이름 인지 검색 기반이 강함" : directFoundRate >= 0.5 ? "직접 검색은 대체로 되나 보완 여지 있음" : "직접 검색에서도 노출이 약함",
  };

  // ---- B. 범주형 추천 가시성 (30) ----
  const recommendedCount = recommendEv.filter((e) => e.mention_type === "recommended_candidate").length;
  const recommendIncludeRate = recommendEv.length ? recommendedCount / recommendEv.length : 0;
  const includeScore = recommendIncludeRate * 18;

  const subCats = Array.from(new Set(recommendQ.map((q) => q.sub_category || q.type)));
  const coveredSubCats = new Set(
    recommendEv
      .filter((e) => e.mention_type === "recommended_candidate")
      .map((e) => {
        const q = queries.find((qq) => qq.id === e.query_id);
        return q?.sub_category || q?.type || "";
      })
  );
  const coverageRate = subCats.length ? coveredSubCats.size / subCats.length : 0;
  const coverageScore = coverageRate * 8;

  const positions = recommendEv
    .filter((e) => e.mention_type === "recommended_candidate" && e.position != null)
    .map((e) => e.position as number);
  const positionStrength = positions.length ? avg(positions.map((p) => 1 - clamp(p - 1, 0, 5) / 5)) : 0;
  const positionScore = (recommendedCount > 0 ? positionStrength : 0) * 4;

  const axisB: AxisScore = {
    axis: "recommend",
    label: "범주형 추천 가시성",
    max: 30,
    raw: round1(includeScore + coverageScore + positionScore),
    breakdown: [
      { label: "추천 포함률", max: 18, value: round1(includeScore) },
      { label: "질의군 커버리지", max: 8, value: round1(coverageScore) },
      { label: "언급 위치·강도", max: 4, value: round1(positionScore) },
    ],
    judgment:
      recommendIncludeRate >= 0.5
        ? "대표 카테고리 추천 후보로 잘 등장함"
        : recommendIncludeRate > 0
        ? "일부 질의에서만 추천 후보로 등장함"
        : "범주형 추천 질의에서 후보로 거의 등장하지 않음",
  };

  // ---- C. 설명 정확도 (20) ----
  const accuracies = allUsable.filter((e) => e.entity_found === 1).map((e) => e.description_accuracy ?? 0);
  const factMatchScore = avg(accuracies) * 12;

  const staleFlags = allUsable.filter((e) => safeParseArray(e.conflicts).some((c) => /과거|오래된|outdated|최신성/.test(c)));
  const staleRate = allUsable.length ? staleFlags.length / allUsable.length : 0;
  const freshnessScore = (1 - staleRate) * 5;

  const errorFlags = allUsable.filter((e) => safeParseArray(e.conflicts).length > 0 && !staleFlags.includes(e));
  const errorRate = allUsable.length ? errorFlags.length / allUsable.length : 0;
  const noErrorScore = (1 - errorRate) * 3;

  const axisC: AxisScore = {
    axis: "accuracy",
    label: "설명 정확도",
    max: 20,
    raw: round1(factMatchScore + freshnessScore + noErrorScore),
    breakdown: [
      { label: "핵심 사실 일치", max: 12, value: round1(factMatchScore) },
      { label: "최신성", max: 5, value: round1(freshnessScore) },
      { label: "과장·오류 없음", max: 3, value: round1(noErrorScore) },
    ],
    judgment: errorRate === 0 && staleRate === 0 ? "공식 정보와 설명이 대체로 일치함" : "일부 정보 충돌 또는 과거 정보가 발견됨",
  };

  // ---- D. 출처 신뢰도 (20) ----
  // 분모는 "브랜드가 실제로 등장한 응답"이다. 등장하지 않은 응답에는 그 브랜드를
  // 뒷받침할 출처가 있을 수 없으므로, 미노출 건을 분모에 넣으면 축 B(추천 가시성)에서
  // 이미 감점된 사실을 여기서 한 번 더 깎는 이중 감점이 된다. 그 결과 이 축의 상한이
  // 노출률에 묶여(노출 50% → 공식 출처 최대 4/8) 출처를 아무리 보강해도 점수가
  // 오르지 않았다. 축 C(설명 정확도)가 이미 entity_found로 거르는 것과 같은 기준이다.
  const foundUsable = allUsable.filter((e) => e.entity_found === 1);
  const trustDenom = foundUsable.length;

  const officialCiteRate = trustDenom
    ? foundUsable.filter((e) => safeParseArray(e.source_types).some((t) => OFFICIAL_TYPES.includes(t as SourceType))).length /
      trustDenom
    : 0;
  const officialSourceScore = officialCiteRate * 8;

  const thirdPartyRate = trustDenom
    ? foundUsable.filter((e) => safeParseArray(e.source_types).some((t) => THIRD_PARTY_AUTHORITY_TYPES.includes(t as SourceType))).length /
      trustDenom
    : 0;
  const thirdPartyScore = thirdPartyRate * 6;

  const distinctSourceTypes = new Set(foundUsable.flatMap((e) => safeParseArray(e.source_types)));
  const diversityScore = Math.min(1, distinctSourceTypes.size / 4) * 4;

  const citationRate = trustDenom
    ? foundUsable.filter((e) => safeParseArray(e.citations).length > 0).length / trustDenom
    : 0;
  const transparencyScore = citationRate * 2;

  // 등장 자체가 0건이면 출처를 평가할 근거가 없다. 중간값으로 메우지 않고 판정보류로
  // 표시한다(PRD 13.8 — 모르는 것을 기본 점수로 채우면 점수가 정보가 아니게 된다).
  const trustUnknown = trustDenom === 0;

  const axisD: AxisScore = {
    axis: "trust",
    label: "출처 신뢰도",
    max: 20,
    raw: round1(officialSourceScore + thirdPartyScore + diversityScore + transparencyScore),
    breakdown: [
      { label: "공식 출처", max: 8, value: round1(officialSourceScore) },
      { label: "제3자 권위 출처", max: 6, value: round1(thirdPartyScore) },
      { label: "출처 다양성", max: 4, value: round1(diversityScore) },
      { label: "인용 투명성", max: 2, value: round1(transparencyScore) },
    ],
    judgment: trustUnknown
      ? "판정보류 — 브랜드가 등장한 응답이 없어 출처를 평가할 수 없음"
      : officialCiteRate > 0.6
      ? "공식 출처 기반이 안정적임"
      : "공식·제3자 출처 보강이 필요함",
  };

  // ---- E. 일관성·최신성 (10) ----
  const conflictChannelFlags = allUsable.filter((e) => safeParseArray(e.conflicts).some((c) => /채널.*(불일치|다름)|정체성.*(혼선|다름)/.test(c)));
  const consistencyRate = allUsable.length ? 1 - conflictChannelFlags.length / allUsable.length : officialAssetCount > 0 ? 0.6 : 0.3;
  const consistencyScore = clamp(consistencyRate, 0, 1) * 5;

  let activityScore = 1.5;
  if (lastActivityWithinDays != null) {
    if (lastActivityWithinDays <= 90) activityScore = 3;
    else if (lastActivityWithinDays <= 365) activityScore = 2;
    else activityScore = 0.5;
  }

  const structuredScore = hasStructuredData ? 2 : 0.5;

  const axisE: AxisScore = {
    axis: "consistency",
    label: "일관성·최신성",
    max: 10,
    raw: round1(consistencyScore + activityScore + structuredScore),
    breakdown: [
      { label: "대표 문장 일치", max: 5, value: round1(consistencyScore) },
      { label: "최근 활동 신호", max: 3, value: round1(activityScore) },
      { label: "구조화 정보", max: 2, value: round1(structuredScore) },
    ],
    judgment: consistencyScore >= 4 ? "채널 간 정체성이 대체로 일치함" : "채널별 소개 문구 통일이 필요함",
  };

  const axes = [axisA, axisB, axisC, axisD, axisE];
  const total = round1(axes.reduce((s, a) => s + a.raw, 0));
  const { grade, gradeLabel } = gradeFor(total);

  const sampleSize = queries.length;
  const engineCount = new Set(evidence.map((e) => e.engine_label)).size;
  const failureRate = evidence.length
    ? evidence.filter((e) => e.status === "collection_failed").length / evidence.length
    : 0;

  let trustBadge: "high" | "medium" | "low" = "low";
  let trustLabel = "제한된 표본으로 점수 해석 주의";
  if (sampleSize >= 15 && engineCount >= 3 && failureRate < 0.1) {
    trustBadge = "high";
    trustLabel = "충분한 표본과 확인된 출처 기반";
  } else if (sampleSize >= 8 && engineCount >= 2) {
    trustBadge = "medium";
    trustLabel = "방향성 판단용, 추가 진단 권장";
  }

  return { axes, total, grade, gradeLabel, sampleSize, engineCount, failureRate: round1(failureRate * 100), trustBadge, trustLabel };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function gradeFor(total: number): { grade: string; gradeLabel: string } {
  if (total >= 85) return { grade: "A", gradeLabel: "추천 기반 강함" };
  if (total >= 70) return { grade: "B", gradeLabel: "기반 양호" };
  if (total >= 50) return { grade: "C", gradeLabel: "이름은 보이나 추천은 약함" };
  if (total >= 30) return { grade: "D", gradeLabel: "정보 분산/오류 가능" };
  return { grade: "E", gradeLabel: "관측 기반 부족" };
}
