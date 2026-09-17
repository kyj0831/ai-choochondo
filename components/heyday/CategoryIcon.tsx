import type { CategoryId } from "@/lib/heyday/types";

/**
 * 카테고리 아이콘.
 * 이모지 대신 선 아이콘을 쓴다 — 기기마다 모양이 달라지지 않고,
 * 서비스가 가벼워 보이지 않는다.
 */
export default function CategoryIcon({
  id,
  size = 36,
}: {
  id: CategoryId;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 32 32",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (id) {
    case "ai": // 대화하는 화면 + 반짝임
      return (
        <svg {...common}>
          <rect x="4" y="5" width="24" height="17" rx="4" />
          <path d="M11 27h10M16 22v5" />
          <path d="M13 13.5l1.6-3.5 1.6 3.5 3.5 1.6-3.5 1.6" />
        </svg>
      );
    case "create": // 카메라 + 재생
      return (
        <svg {...common}>
          <rect x="3" y="8" width="20" height="17" rx="4" />
          <path d="M23 16l6-4v13l-6-4" />
          <path d="M11 14.5l4.5 2.5-4.5 2.5z" />
        </svg>
      );
    case "culture": // 티켓
      return (
        <svg {...common}>
          <path d="M4 10a2 2 0 012-2h20a2 2 0 012 2v3a3 3 0 000 6v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a3 3 0 000-6z" />
          <path d="M18 9v3M18 15v3M18 21v2" />
        </svg>
      );
    default: // 팔레트
      return (
        <svg {...common}>
          <path d="M16 4a12 12 0 100 24c1.9 0 2.6-1.4 1.8-2.6-1-1.5.1-3.4 1.9-3.4H23a5 5 0 005-5c0-7.2-5.4-13-12-13z" />
          <circle cx="11" cy="13" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="17" cy="10" r="1.6" fill="currentColor" stroke="none" />
          <circle cx="22" cy="15" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}
