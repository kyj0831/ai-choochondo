import Link from "next/link";
import Avatar from "@/components/heyday/Avatar";
import { availabilityNote, href, priceLabel, type Flow } from "@/lib/heyday/flow";
import type { MateMatch } from "@/lib/heyday/flow";

/**
 * Mate 카드.
 *
 * 가격을 카드에서부터 그대로 보여준다. 가격을 상세 화면에 숨기면
 * "가격을 보고도 요청하는가"라는 이번 MVP의 질문에 답할 수 없다.
 */
export default function MateCard({ match, flow }: { match: MateMatch; flow: Flow }) {
  const { mate, missing } = match;

  return (
    <Link
      href={href(`/heyday/mates/${mate.id}`, flow)}
      className="hd-card flex flex-col gap-4"
    >
      <div className="flex items-start gap-4">
        <Avatar variant={mate.avatar} size={72} />
        <div className="min-w-0 flex-1">
          <p className="text-[19px] font-bold">
            {mate.name} <span className="text-ink-500">· {mate.age}세</span>
          </p>
          <p className="mt-0.5 text-[15px] font-semibold text-heyday-700">
            {mate.headline}
          </p>
          <p className="mt-1 text-[15px] text-ink-500">
            {mate.districts.slice(0, 3).map((d) => d.replace(/구$/, "")).join("·")} 활동
          </p>
          <p className="mt-1 text-[15px] text-ink-500">
            활동 {mate.sessionCount}회 · ★ {mate.rating.toFixed(1)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="hd-badge-verified">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          인증 완료
        </span>
        <span
          className={`hd-chip ${
            missing.time ? "bg-sand-100 text-ink-500" : "bg-heyday-50 text-heyday-700"
          }`}
        >
          {availabilityNote(mate, flow)}
        </span>
      </div>

      {(missing.district || missing.time) && (
        <p className="rounded-xl bg-sand-100 px-3 py-2 text-[14px] text-ink-500">
          {missing.district && flow.district
            ? `${flow.district}는 활동 지역이 아니에요. `
            : ""}
          {missing.time ? "고른 시간에는 어려워요. " : ""}
          예약 요청할 때 다른 날짜·장소를 적어주시면 조율해 드려요.
        </p>
      )}

      <div className="flex items-center justify-between border-t border-sand-200 pt-4">
        <span className="hd-price">{priceLabel(mate)}</span>
        <span className="inline-flex items-center gap-1 text-[16px] font-bold text-heyday-600">
          프로필 보기
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
