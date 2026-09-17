/**
 * HeyDay MVP 타입.
 *
 * 이 MVP는 "예쁜 앱"이 아니라 가설 검증이 목적이다.
 * 따라서 타입도 검증에 필요한 최소한만 둔다 —
 * 회원·결제·인증은 이번 버전에 존재하지 않는다(PRD 13장).
 */

/** 시간대. 5060 사용자에게 24시간 단위 선택은 부담이라 세 덩어리로만 나눈다. */
export type SlotKey = "morning" | "afternoon" | "evening";

export interface SlotDef {
  key: SlotKey;
  label: string;
  /** 몇 시쯤인지 한 줄로 알려준다. "오후"만으로는 언제인지 모른다. */
  hint: string;
}

export type CategoryId = "ai" | "create" | "culture" | "hobby";

export interface Category {
  id: CategoryId;
  label: string;
  /** 홈에서 카테고리 밑에 붙는 한 줄. 사용자 발화체로 쓴다. */
  tagline: string;
  /** 이 영역에서 흔히 쓰는 시간·가격대(PRD 9장 가설값). */
  priceNote: string;
}

export interface Activity {
  id: string;
  categoryId: CategoryId;
  label: string;
  /** 이 활동으로 무엇이 남는지. 기능이 아니라 결과를 쓴다. */
  blurb: string;
}

/** 서울 5개 권역. 화면에는 전 지역을 열되 운영 밀도는 별개다(PRD 11장). */
export interface RegionGroup {
  id: string;
  label: string;
  districts: string[];
}

export interface Review {
  author: string;
  /** 후기 작성자 나이대. "62세"처럼 또래가 썼다는 것이 신뢰 근거가 된다. */
  age: number;
  activity: string;
  rating: number;
  text: string;
}

export interface Mate {
  id: string;
  name: string;
  age: number;
  /** 아바타 일러스트 변형 번호(0-7). 실제 사진은 MVP 범위 밖이다. */
  avatar: number;
  /** 목록에서 이름 옆에 붙는 한 줄 전문성. */
  headline: string;
  intro: string;
  /** 전문 분야 태그. */
  specialties: string[];
  /** 함께 할 수 있는 활동 id 목록. */
  activityIds: string[];
  /** 활동 가능한 서울 자치구. */
  districts: string[];
  /** 요일(0=일)별 가능한 시간대. */
  availability: Record<number, SlotKey[]>;
  durationMin: number;
  price: number;
  rating: number;
  sessionCount: number;
  /** 인증 배지. MVP에서는 UI 표현만 하고 실제 검증 시스템은 없다(PRD 6장). */
  badges: string[];
  reviews: Review[];
}

/** 예약 요청. MVP에서는 결제 없이 "요청"까지만 간다(PRD 9장). */
export interface BookingInput {
  sessionId: string;
  mateId: string;
  categoryId: string;
  activityId: string;
  district: string;
  date: string;
  slot: SlotKey;
  durationMin: number;
  price: number;
  guestName: string;
  guestPhone: string;
  note?: string;
}

export interface Booking extends BookingInput {
  id: string;
  /** 재이용 의향. 완료 화면에서 한 번 묻는다(PRD 17장 Retention 가설). */
  reuseIntent: "yes" | "maybe" | "no" | null;
  status: string;
  createdAt: string;
}
