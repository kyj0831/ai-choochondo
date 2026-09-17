import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/heyday/Avatar";
import ReuseIntent from "@/components/heyday/ReuseIntent";
import Track from "@/components/heyday/Track";
import { activityById, mateById } from "@/lib/heyday/data";
import { getBooking } from "@/lib/heyday/db";
import { dateLabel, slotLabel } from "@/lib/heyday/flow";

export const dynamic = "force-dynamic";

/** Screen 8 — 예약 완료. 무엇이 언제 일어나는지만 분명히 말한다. */
export default function DonePage({ params }: { params: { id: string } }) {
  const booking = getBooking(params.id);
  if (!booking) notFound();

  const mate = mateById(booking.mateId);
  const activity = activityById(booking.activityId);
  if (!mate || !activity) notFound();

  return (
    <main className="pt-6">
      <Track event="booking_done" props={{ mate: mate.id, price: booking.price }} />

      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-leaf-50">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden className="text-leaf-500">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <h1 className="mt-5 text-[30px] font-black leading-snug tracking-tight">
        예약 요청을
        <br />
        보냈어요
      </h1>
      <p className="mt-3 text-[17px] leading-relaxed text-ink-500">
        {mate.name} 메이트가 가능 여부를 확인한 뒤,
        <br />
        적어주신 번호로 연락드릴게요.
      </p>

      <section className="mt-6 rounded-2xl border-2 border-sand-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <Avatar variant={mate.avatar} size={56} />
          <div>
            <p className="text-[18px] font-bold">{mate.name}</p>
            <p className="text-[15px] text-ink-500">{mate.headline}</p>
          </div>
        </div>
        <dl className="mt-5 space-y-3 text-[17px]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">하고 싶은 일</dt>
            <dd className="text-right font-bold">{activity.label}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">언제</dt>
            <dd className="text-right font-bold">
              {dateLabel(booking.date)} {slotLabel(booking.slot)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">어디서</dt>
            <dd className="text-right font-bold">{booking.district}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-sand-200 pt-3">
            <dt className="text-ink-500">가격</dt>
            <dd className="text-right font-extrabold">
              {booking.price.toLocaleString("ko-KR")}원
              <span className="ml-1 text-[15px] font-semibold text-ink-400">
                / {booking.durationMin}분
              </span>
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-[14px] text-ink-400">
          예약 번호 {booking.id} · {booking.guestName}님
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[19px] font-bold">
          이번에 만나보시고, 또 부르실 것 같으세요?
        </h2>
        <ReuseIntent bookingId={booking.id} />
      </section>

      <div className="mt-9 space-y-3">
        <Link href="/heyday" className="hd-btn-secondary">
          다른 일도 둘러보기
        </Link>
      </div>

      <p className="mt-6 text-center text-[14px] leading-relaxed text-ink-400">
        시범 서비스입니다. 결제는 이루어지지 않았습니다.
      </p>
    </main>
  );
}
