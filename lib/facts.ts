import { EntityType, GroundTruthFact } from "./types";

/**
 * 사실 기준선(Ground Truth)의 항목 정의 — 업종 유형별.
 *
 * 왜 유형별로 나누는가.
 * 처음 항목은 '직함/업종 · 대표 실적 · 최근 활동'이었다. 강사·개인 브랜드에 맞는 칸이다.
 * 그런데 소상공인이 AI에게 당하는 오류는 "22:30 마감인데 21시 마감", "영업 중인데 폐업"처럼
 * 영업시간·주소·영업 상태에서 난다. 그 사실을 입력할 칸이 없으면 판정도 못 잡고,
 * 허브에 실어 바로잡을 수도 없다. 제품이 고치겠다고 한 것을 입력할 곳이 없었던 셈이다.
 *
 * 이 파일이 유일한 정의다. 입력 화면(setup)·판정(judge)·공개 허브(page/JSON-LD/llms.txt)가
 * 모두 여기를 본다. 항목을 더하거나 이름을 바꾸려면 여기만 고친다.
 */

export type SchemaProp = "streetAddress" | "openingHours" | "telephone" | "email";

export interface FactField {
  /** DB의 ground_truth_facts.field 값. 사람이 읽는 라벨을 그대로 키로 쓴다(기존 데이터 호환). */
  key: string;
  placeholder: string;
  /**
   * schema.org로 내보낼 속성. 없는 항목은 사람이 읽는 페이지와 llms.txt에만 실린다.
   * 형식이 엄격한 속성(openingHours)도 schema.org에서 Text를 허용하므로 자유 서술을 그대로 넣는다.
   */
  schema?: SchemaProp;
  /** 정확도 판정과 허브 완성도에서 '핵심 사실'로 취급하는 항목 */
  core?: boolean;
}

const LOCAL_BUSINESS: FactField[] = [
  { key: "주소", placeholder: "예: 서울 종로구 창의문로 62 (부암동)", schema: "streetAddress", core: true },
  { key: "영업시간", placeholder: "예: 매일 10:00~22:30", schema: "openingHours", core: true },
  { key: "휴무일", placeholder: "예: 연중무휴 / 매주 월요일" },
  { key: "영업 상태", placeholder: "예: 정상 영업 중 (2026년 9월 기준)", core: true },
  { key: "전화번호", placeholder: "예: 02-000-0000", schema: "telephone" },
  { key: "대표 메뉴·상품", placeholder: "예: 핸드드립, 하우스 블렌드, 원두 판매" },
  { key: "주차·편의", placeholder: "예: 주차 2대 가능, 반려동물 동반 가능" },
  { key: "대표 실적", placeholder: "예: 1990년 개업, OO 방송 소개" },
];

const PERSONAL_BRAND: FactField[] = [
  { key: "직함/업종", placeholder: "예: AI 커뮤니케이터, 한식당 대표", core: true },
  { key: "지역", placeholder: "예: 서울 종로구" },
  { key: "제공 서비스", placeholder: "예: 기업 강연, AI 활용 컨설팅", core: true },
  { key: "대표 실적", placeholder: "예: 000기업 강연 50회, OO상 수상" },
  { key: "최근 활동", placeholder: "예: 2026년 6월 신간 출간" },
  { key: "문의", placeholder: "예: contact@example.com", schema: "email" },
];

const PROFESSIONAL_SERVICE: FactField[] = [
  { key: "주소", placeholder: "예: 서울 강남구 테헤란로 000, 5층", schema: "streetAddress", core: true },
  { key: "영업시간", placeholder: "예: 평일 09:00~18:00", schema: "openingHours", core: true },
  { key: "전화번호", placeholder: "예: 02-000-0000", schema: "telephone" },
  { key: "제공 서비스", placeholder: "예: 세무 기장, 법인 설립 대행", core: true },
  { key: "자격·면허", placeholder: "예: 세무사 등록번호 000, 변호사" },
  { key: "대표 실적", placeholder: "예: 상담 1,000건, OO 자문" },
];

const COMPANY: FactField[] = [
  { key: "본사 주소", placeholder: "예: 서울 성동구 성수이로 000", schema: "streetAddress", core: true },
  { key: "대표 전화", placeholder: "예: 02-000-0000", schema: "telephone" },
  { key: "제품·서비스", placeholder: "예: B2B SaaS, 스마트팜 센서", core: true },
  { key: "설립", placeholder: "예: 2019년 설립, 임직원 30명" },
  { key: "대표 실적", placeholder: "예: 시리즈A 유치, OO 인증" },
  { key: "최근 활동", placeholder: "예: 2026년 8월 신제품 출시" },
];

export function factFieldsFor(entityType: string): FactField[] {
  switch (entityType as EntityType) {
    case "자영업/로컬":
      return LOCAL_BUSINESS;
    case "전문 서비스":
      return PROFESSIONAL_SERVICE;
    case "기업/제품":
      return COMPANY;
    case "개인 브랜드/강사":
    default:
      return PERSONAL_BRAND;
  }
}

/** 허브에 실을 수 있는, 승인된 사실만 고른다. 입력 순서(정의 순서)를 유지한다. */
export function publishableFacts(entityType: string, facts: GroundTruthFact[]): { key: string; value: string; schema?: SchemaProp }[] {
  const defs = factFieldsFor(entityType);
  const byKey = new Map(facts.filter((f) => f.approved && f.value.trim()).map((f) => [f.field, f.value.trim()]));

  const ordered: { key: string; value: string; schema?: SchemaProp }[] = [];
  for (const d of defs) {
    const v = byKey.get(d.key);
    if (v) {
      ordered.push({ key: d.key, value: v, schema: d.schema });
      byKey.delete(d.key);
    }
  }
  // 정의에 없는 키(업종 유형을 바꾸기 전에 입력한 것 등)도 버리지 않고 뒤에 붙인다.
  // 사장님이 직접 확인한 사실이라면 어떤 이름이든 공개할 가치가 있다.
  for (const [key, value] of byKey) ordered.push({ key, value });
  return ordered;
}

/** 핵심 사실이 몇 개 채워졌는지. 허브 완성도 항목으로 쓴다. */
export function coreFactCoverage(entityType: string, facts: GroundTruthFact[]): { filled: number; total: number; missing: string[] } {
  const core = factFieldsFor(entityType).filter((d) => d.core);
  const have = new Set(facts.filter((f) => f.approved && f.value.trim()).map((f) => f.field));
  const missing = core.filter((d) => !have.has(d.key)).map((d) => d.key);
  return { filled: core.length - missing.length, total: core.length, missing };
}
