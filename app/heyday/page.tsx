import Link from "next/link";
import CategoryIcon from "@/components/heyday/CategoryIcon";
import Track from "@/components/heyday/Track";
import { CATEGORIES } from "@/lib/heyday/data";

/**
 * Screen 1 — 홈.
 *
 * 첫 질문이 이 서비스의 입장을 정한다.
 * "무엇을 도와드릴까요"가 아니라 "오늘 무엇을 해보고 싶으세요"라고 묻는다.
 */
export default function HeydayHome() {
  return (
    <main>
      <Track event="home_viewed" />

      <header className="pt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[26px] font-black tracking-tight text-heyday-500">
            HeyDay
          </span>
          <span className="text-[15px] font-semibold text-ink-400">헤이데이</span>
        </div>
      </header>

      <h1 className="mt-8 text-[32px] font-black leading-[1.25] tracking-tight">
        오늘 뭐
        <br />
        해보고 싶으세요?
      </h1>
      <p className="mt-3 text-[17px] text-ink-500">
        하고 싶은 걸 고르면, 함께 해줄 메이트를 보여드려요.
      </p>

      <div className="mt-7 space-y-3">
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            href={`/heyday/activity?c=${c.id}`}
            className="hd-card flex items-center gap-4"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-heyday-50 text-heyday-600">
              <CategoryIcon id={c.id} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[20px] font-bold">{c.label}</span>
              <span className="mt-0.5 block text-[15px] leading-snug text-ink-500">
                {c.tagline}
              </span>
            </span>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="text-ink-400">
              <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>

      <section className="mt-9 rounded-2xl bg-white/70 p-5">
        <h2 className="text-[16px] font-bold">HeyDay는 이렇게 진행돼요</h2>
        <ol className="mt-3 space-y-2 text-[15px] text-ink-500">
          <li>1. 하고 싶은 일과 날짜, 만날 동네를 고릅니다.</li>
          <li>2. 조건에 맞는 메이트와 가격을 보고 직접 고릅니다.</li>
          <li>3. 예약을 요청하면 메이트가 가능 여부를 확인해 연락드려요.</li>
        </ol>
        <p className="mt-4 text-[14px] leading-relaxed text-ink-400">
          지금은 서울에서 시범 운영 중입니다. 앱에서 바로 결제하지 않고,
          메이트와 일정이 확정된 뒤에 진행됩니다.
        </p>
      </section>

      <p className="mt-6 text-center text-[13px] text-ink-400">
        간병·의료·금융 관련 도움은 다루지 않습니다.
      </p>
    </main>
  );
}
