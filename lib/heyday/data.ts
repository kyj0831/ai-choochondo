import type {
  Activity,
  Category,
  Mate,
  RegionGroup,
  SlotDef,
  SlotKey,
} from "./types";

/**
 * HeyDay MVP의 전체 목 데이터.
 *
 * 실제 DB가 아니라 파일에 두는 이유: 이번 MVP가 검증하려는 것은
 * "5060이 가격을 보고 예약을 요청하는가"이지 데이터 운영이 아니다.
 * Mate를 바꿔가며 A/B로 보여주는 일은 이 파일 한 곳만 고치면 된다.
 */

export const SLOTS: SlotDef[] = [
  { key: "morning", label: "오전", hint: "9시 ~ 12시" },
  { key: "afternoon", label: "오후", hint: "12시 ~ 5시" },
  { key: "evening", label: "저녁", hint: "5시 ~ 8시" },
];

export const CATEGORIES: Category[] = [
  {
    id: "ai",
    label: "AI · 디지털",
    tagline: "챗GPT, 스마트폰, 새 앱을 제대로 한번 배우기",
    priceNote: "60~90분 · 3만~4만원대",
  },
  {
    id: "create",
    label: "콘텐츠 · 창작",
    tagline: "유튜브, 숏폼, SNS, 글쓰기를 직접 시작하기",
    priceNote: "90분 · 3만~5만원대",
  },
  {
    id: "culture",
    label: "문화 · 외출",
    tagline: "영화, 전시, 공연을 함께 보러 가기",
    priceNote: "2시간 · 4만~6만원대",
  },
  {
    id: "hobby",
    label: "취미 · 배움",
    tagline: "그림, 외국어, 운동 — 새로 하나 시작하기",
    priceNote: "2시간 · 4만~6만원대",
  },
];

export const ACTIVITIES: Activity[] = [
  // 01. AI · 디지털
  { id: "chatgpt", categoryId: "ai", label: "챗GPT 배우기", blurb: "내 일에 바로 쓰는 질문법까지" },
  { id: "phone", categoryId: "ai", label: "스마트폰 정리하고 배우기", blurb: "느려진 폰, 모르는 설정 한 번에" },
  { id: "photos", categoryId: "ai", label: "사진 정리하기", blurb: "수천 장을 앨범과 백업으로" },
  { id: "newapp", categoryId: "ai", label: "새로운 앱 배우기", blurb: "지도·예매·배달·은행 앱까지" },

  // 02. 콘텐츠 · 창작
  { id: "youtube", categoryId: "create", label: "유튜브 시작하기", blurb: "채널 개설부터 첫 영상 업로드까지" },
  { id: "shorts", categoryId: "create", label: "숏폼 만들기", blurb: "휴대폰만으로 1분 영상 한 편" },
  { id: "sns", categoryId: "create", label: "인스타그램 · 스레드 시작", blurb: "계정 만들고 첫 게시물까지" },
  { id: "writing", categoryId: "create", label: "글쓰기 · 브런치", blurb: "내 이야기를 읽히는 글로" },
  { id: "photovideo", categoryId: "create", label: "사진 · 영상 찍고 편집하기", blurb: "촬영부터 편집 앱 사용까지" },
  { id: "lecture", categoryId: "create", label: "내 경험으로 강의 만들기", blurb: "커리큘럼과 발표 자료까지" },

  // 03. 문화 · 외출
  { id: "movie", categoryId: "culture", label: "영화 함께 보기", blurb: "예매부터 관람 후 이야기까지" },
  { id: "exhibit", categoryId: "culture", label: "전시 보러 가기", blurb: "동행하며 작품 설명까지" },
  { id: "concert", categoryId: "culture", label: "공연 보러 가기", blurb: "티켓 예매와 동행" },
  { id: "bookcafe", categoryId: "culture", label: "서점 · 카페 나들이", blurb: "책 고르고 이야기 나누기" },
  { id: "festival", categoryId: "culture", label: "문화행사 참여", blurb: "축제·마켓·강연 함께 가기" },

  // 04. 취미 · 배움
  { id: "art", categoryId: "hobby", label: "그림 그리기", blurb: "드로잉 도구부터 첫 작품까지" },
  { id: "language", categoryId: "hobby", label: "외국어 공부", blurb: "회화 위주로 편하게" },
  { id: "walk", categoryId: "hobby", label: "운동 · 걷기", blurb: "동네 코스와 자세 잡기" },
  { id: "newhobby", categoryId: "hobby", label: "새로운 취미 찾기", blurb: "뭘 좋아할지부터 같이 고르기" },
  { id: "interest", categoryId: "hobby", label: "관심사 활동", blurb: "커뮤니티·모임 찾아 함께 가보기" },
];

export const REGION_GROUPS: RegionGroup[] = [
  { id: "central", label: "도심권", districts: ["종로구", "중구", "용산구"] },
  { id: "northwest", label: "서북권", districts: ["은평구", "서대문구", "마포구"] },
  {
    id: "southeast",
    label: "동남권",
    districts: ["서초구", "강남구", "송파구", "강동구"],
  },
  {
    id: "northeast",
    label: "동북권",
    districts: [
      "성동구", "광진구", "동대문구", "중랑구",
      "성북구", "강북구", "도봉구", "노원구",
    ],
  },
  {
    id: "southwest",
    label: "서남권",
    districts: [
      "양천구", "강서구", "구로구", "금천구",
      "영등포구", "동작구", "관악구",
    ],
  },
];

/** 요일별 가능 시간대를 짧게 쓰기 위한 도우미. 0=일요일. */
function weekdays(spec: Record<string, SlotKey[]>): Record<number, SlotKey[]> {
  const map: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
  const out: Record<number, SlotKey[]> = {};
  for (const [days, slots] of Object.entries(spec)) {
    for (const d of days.split("")) out[map[d]] = slots;
  }
  return out;
}

export const MATES: Mate[] = [
  {
    id: "minji",
    name: "김민지",
    age: 32,
    avatar: 0,
    headline: "AI · 유튜브 · 영상",
    intro:
      "IT 회사에서 5년째 콘텐츠를 만들고 있어요. 챗GPT는 회사에서 매일 쓰는 도구라, 어떻게 물어봐야 제대로 답하는지 알려드릴 수 있습니다. 처음 배우는 분께는 손에 익을 때까지 천천히 같이 해요.",
    specialties: ["챗GPT", "유튜브 채널 개설", "영상 편집"],
    activityIds: ["chatgpt", "newapp", "youtube", "shorts", "photovideo"],
    districts: ["종로구", "중구", "마포구", "서대문구"],
    availability: weekdays({ 월화수목금: ["afternoon", "evening"], 토: ["morning", "afternoon"] }),
    durationMin: 90,
    price: 39000,
    rating: 4.9,
    sessionCount: 32,
    badges: ["본인 확인", "직장 확인", "HeyDay 기본교육"],
    reviews: [
      {
        author: "정○○",
        age: 61,
        activity: "챗GPT 배우기",
        rating: 5,
        text: "질문을 어떻게 던져야 하는지를 알려줘서, 집에 와서 혼자 해봤는데도 됐어요. 그게 제일 좋았습니다.",
      },
      {
        author: "이○○",
        age: 58,
        activity: "유튜브 시작하기",
        rating: 5,
        text: "채널 만들고 첫 영상까지 그날 올렸어요. 어렵게 설명하지 않아서 좋았어요.",
      },
      {
        author: "박○○",
        age: 66,
        activity: "챗GPT 배우기",
        rating: 4,
        text: "90분이 짧게 느껴졌습니다. 다음에 한 번 더 부르려고요.",
      },
    ],
  },
  {
    id: "junseo",
    name: "박준서",
    age: 28,
    avatar: 1,
    headline: "숏폼 · 촬영 · 편집",
    intro:
      "숏폼 편집으로 먹고삽니다. 구독자 3만 채널을 직접 운영하고 있어요. 휴대폰 하나로 찍고 편집해서 올리는 것까지, 한 번에 한 편 완성하는 걸 목표로 합니다.",
    specialties: ["숏폼", "휴대폰 촬영", "편집 앱"],
    activityIds: ["shorts", "youtube", "photovideo", "sns"],
    districts: ["마포구", "서대문구", "은평구", "종로구"],
    availability: weekdays({ 화수목금: ["afternoon", "evening"], 토일: ["afternoon"] }),
    durationMin: 90,
    price: 45000,
    rating: 4.8,
    sessionCount: 21,
    badges: ["본인 확인", "HeyDay 기본교육"],
    reviews: [
      {
        author: "최○○",
        age: 63,
        activity: "숏폼 만들기",
        rating: 5,
        text: "제 손으로 1분짜리를 한 편 만들어서 올렸어요. 조회수 800이 나왔습니다.",
      },
      {
        author: "한○○",
        age: 55,
        activity: "사진 · 영상 찍고 편집하기",
        rating: 5,
        text: "편집 앱이 어렵다고만 생각했는데, 쓰는 기능은 몇 개 안 된다는 걸 알았어요.",
      },
    ],
  },
  {
    id: "seoyeon",
    name: "이서연",
    age: 35,
    avatar: 2,
    headline: "스마트폰 · 챗GPT · 사진 정리",
    intro:
      "복지관에서 3년간 디지털 교육을 했고, 지금은 1:1로만 만납니다. 여러 번 물어보셔도 괜찮아요. 그날 배운 걸 적어드리는 메모를 꼭 남깁니다.",
    specialties: ["스마트폰", "사진 정리", "챗GPT 입문"],
    activityIds: ["chatgpt", "phone", "photos", "newapp"],
    districts: ["강남구", "서초구", "송파구"],
    availability: weekdays({ 월화수목금: ["morning", "afternoon"] }),
    durationMin: 60,
    price: 35000,
    rating: 5.0,
    sessionCount: 48,
    badges: ["본인 확인", "직장 확인", "HeyDay 기본교육", "인터뷰 완료"],
    reviews: [
      {
        author: "김○○",
        age: 69,
        activity: "스마트폰 정리하고 배우기",
        rating: 5,
        text: "몇 번을 다시 물어봐도 싫은 내색 없이 알려주셨어요. 적어준 메모 보고 계속 하고 있습니다.",
      },
      {
        author: "윤○○",
        age: 64,
        activity: "사진 정리하기",
        rating: 5,
        text: "사진 8천 장이 정리됐어요. 손주 사진만 따로 앨범을 만들어줬습니다.",
      },
      {
        author: "서○○",
        age: 57,
        activity: "챗GPT 배우기",
        rating: 5,
        text: "쉬운 말로만 설명해줘서 하나도 안 어려웠어요.",
      },
    ],
  },
  {
    id: "haram",
    name: "정하람",
    age: 24,
    avatar: 3,
    headline: "전시 · 공연 동행",
    intro:
      "미술사를 전공했고 주말마다 전시를 보러 다닙니다. 작품 앞에서 아는 척하지 않고, 같이 보면서 이야기 나누는 걸 좋아해요. 예매와 동선은 제가 다 준비해 갑니다.",
    specialties: ["전시 해설", "공연 예매", "동선 준비"],
    activityIds: ["exhibit", "concert", "movie", "bookcafe", "festival"],
    districts: ["종로구", "중구", "용산구", "성동구"],
    availability: weekdays({ 목금: ["afternoon"], 토일: ["morning", "afternoon", "evening"] }),
    durationMin: 120,
    price: 48000,
    rating: 4.7,
    sessionCount: 15,
    badges: ["본인 확인", "학교 확인", "HeyDay 기본교육"],
    reviews: [
      {
        author: "오○○",
        age: 60,
        activity: "전시 보러 가기",
        rating: 5,
        text: "혼자 갔으면 30분 만에 나왔을 전시를 두 시간 봤어요. 설명이 재미있었습니다.",
      },
      {
        author: "강○○",
        age: 59,
        activity: "공연 보러 가기",
        rating: 4,
        text: "예매를 다 해줘서 편했어요. 다음엔 다른 공연도 같이 가기로 했습니다.",
      },
    ],
  },
  {
    id: "yunho",
    name: "최윤호",
    age: 41,
    avatar: 4,
    headline: "강의 콘텐츠 · 글쓰기",
    intro:
      "기업 교육 기획을 12년 했습니다. '내가 아는 걸 남한테 어떻게 전하지?'가 제 일이었어요. 경험을 강의나 책으로 만들고 싶은 분과 잘 맞습니다.",
    specialties: ["강의 커리큘럼", "발표 자료", "글쓰기"],
    activityIds: ["lecture", "writing", "chatgpt"],
    districts: ["강남구", "서초구", "중구", "종로구"],
    availability: weekdays({ 월수금: ["evening"], 토: ["morning", "afternoon"] }),
    durationMin: 90,
    price: 50000,
    rating: 4.9,
    sessionCount: 27,
    badges: ["본인 확인", "직장 확인", "HeyDay 기본교육", "인터뷰 완료"],
    reviews: [
      {
        author: "임○○",
        age: 62,
        activity: "내 경험으로 강의 만들기",
        rating: 5,
        text: "30년 한 일을 두 시간짜리 강의로 정리했어요. 다음 달에 실제로 강의를 합니다.",
      },
      {
        author: "송○○",
        age: 56,
        activity: "글쓰기 · 브런치",
        rating: 5,
        text: "쓰고 싶은 이야기는 있는데 시작을 못 했거든요. 첫 글을 그날 올렸습니다.",
      },
    ],
  },
  {
    id: "jiwoo",
    name: "한지우",
    age: 29,
    avatar: 5,
    headline: "브런치 · 인스타그램 · 스레드",
    intro:
      "브런치 작가로 3년째 글을 씁니다. 글을 잘 쓰는 법보다, 계속 쓰게 되는 방법을 알려드리는 편이에요. SNS 계정 만들고 운영하는 것도 같이 합니다.",
    specialties: ["브런치", "인스타그램", "꾸준히 쓰는 습관"],
    activityIds: ["writing", "sns", "shorts"],
    districts: ["마포구", "서대문구", "용산구", "영등포구"],
    availability: weekdays({ 월화목: ["afternoon", "evening"], 일: ["afternoon"] }),
    durationMin: 90,
    price: 38000,
    rating: 4.8,
    sessionCount: 19,
    badges: ["본인 확인", "HeyDay 기본교육"],
    reviews: [
      {
        author: "배○○",
        age: 58,
        activity: "글쓰기 · 브런치",
        rating: 5,
        text: "제 글에 댓글이 달리는 걸 처음 봤어요. 계속 쓰고 있습니다.",
      },
      {
        author: "노○○",
        age: 65,
        activity: "인스타그램 · 스레드 시작",
        rating: 4,
        text: "계정을 만들고 사진 올리는 것까지 했습니다. 해시태그가 뭔지 알게 됐어요.",
      },
    ],
  },
  {
    id: "sejin",
    name: "오세진",
    age: 37,
    avatar: 6,
    headline: "그림 · 취미 시작 · 걷기",
    intro:
      "회사를 다니며 주말에 그림을 그립니다. 뭘 시작할지 모르겠다는 분과 같이 골라보는 시간을 좋아해요. 도구는 제가 챙겨 갑니다.",
    specialties: ["드로잉", "취미 탐색", "동네 걷기 코스"],
    activityIds: ["art", "newhobby", "walk", "interest", "bookcafe"],
    districts: ["송파구", "강동구", "광진구", "성동구"],
    availability: weekdays({ 화목: ["evening"], 토일: ["morning", "afternoon"] }),
    durationMin: 120,
    price: 42000,
    rating: 4.6,
    sessionCount: 12,
    badges: ["본인 확인", "HeyDay 기본교육"],
    reviews: [
      {
        author: "구○○",
        age: 61,
        activity: "그림 그리기",
        rating: 5,
        text: "40년 만에 연필을 잡았습니다. 생각보다 잘 그려져서 놀랐어요.",
      },
      {
        author: "문○○",
        age: 54,
        activity: "새로운 취미 찾기",
        rating: 4,
        text: "뭘 좋아하는지 모르겠다고 했더니 세 가지를 같이 해봤어요.",
      },
    ],
  },
  {
    id: "daeun",
    name: "신다은",
    age: 26,
    avatar: 7,
    headline: "스마트폰 · 앱 · 영어회화",
    intro:
      "영어를 가르치다가 지금은 디지털 교육도 함께 합니다. 배달·지도·은행 앱처럼 생활에서 바로 쓰는 것부터 시작하는 걸 권해요.",
    specialties: ["생활 앱", "스마트폰 기본", "영어회화"],
    activityIds: ["phone", "newapp", "photos", "language"],
    districts: ["송파구", "강동구", "강남구", "노원구"],
    availability: weekdays({ 월화수목금: ["morning"], 토: ["afternoon", "evening"] }),
    durationMin: 60,
    price: 30000,
    rating: 4.7,
    sessionCount: 24,
    badges: ["본인 확인", "학교 확인", "HeyDay 기본교육"],
    reviews: [
      {
        author: "황○○",
        age: 67,
        activity: "새로운 앱 배우기",
        rating: 5,
        text: "지도 앱으로 길 찾는 걸 배웠어요. 이제 혼자 버스 타고 다닙니다.",
      },
      {
        author: "조○○",
        age: 57,
        activity: "외국어 공부",
        rating: 4,
        text: "말을 시켜주니까 입이 트였어요. 부담 없이 했습니다.",
      },
    ],
  },
];

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((c) => c.id === id);
}

export function activityById(id: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.id === id);
}

export function activitiesOf(categoryId: string): Activity[] {
  return ACTIVITIES.filter((a) => a.categoryId === categoryId);
}

export function mateById(id: string): Mate | undefined {
  return MATES.find((m) => m.id === id);
}

export const ALL_DISTRICTS: string[] = REGION_GROUPS.flatMap((g) => g.districts);

/** 해당 자치구에서 활동하는 Mate 수. 지역 선택 화면에서 기대치를 미리 알려준다. */
export function mateCountIn(district: string, activityId?: string): number {
  return MATES.filter(
    (m) =>
      m.districts.includes(district) &&
      (!activityId || m.activityIds.includes(activityId))
  ).length;
}
