import { notFound, redirect } from "next/navigation";
import Avatar from "@/components/heyday/Avatar";
import RequestForm from "@/components/heyday/RequestForm";
import TopBar from "@/components/heyday/TopBar";
import Track from "@/components/heyday/Track";
import { activityById, mateById } from "@/lib/heyday/data";
import { dateLabel, href, priceLabel, readFlow, slotLabel } from "@/lib/heyday/flow";

export const dynamic = "force-dynamic";

/**
 * Screen 7 — 예약 요청.
 *
 * 요청 직전에 가격을 한 번 더 크게 보여준다.
 * 가격을 본 상태에서 누른 요청만이 검증에 쓸 수 있는 신호다.
 */
export default function RequestPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const flow = readFlow(searchParams);
  const mate = mateById(params.id);
  if (!mate) notFound();
  const activity = flow.activity ? activityById(flow.activity) : undefined;
  if (!activity || !flow.date || !flow.slot || !flow.district) redirect("/heyday");

  return (
    <main>
      <Track event="request_started" props={{ mate: mate.id, price: mate.price }} />
      <TopBar backHref={href(`/heyday/mates/${mate.id}`, flow)} backLabel="프로필로" step={5} />

      <h1 className="mt-5 text-[28px] font-black leading-snug tracking-tight">
        이렇게 요청할게요
      </h1>

      <section className="mt-5 rounded-2xl border-2 border-sand-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <Avatar variant={mate.avatar} size={56} />
          <div>
            <p className="text-[18px] font-bold">
              {mate.name} <span className="text-ink-500">· {mate.age}세</span>
            </p>
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
              {dateLabel(flow.date)} {slotLabel(flow.slot)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-500">어디서</dt>
            <dd className="text-right font-bold">{flow.district}</dd>
          </div>
        </dl>

        <div className="mt-5 flex items-end justify-between border-t border-sand-200 pt-4">
          <span className="text-[17px] font-bold text-ink-500">
            {mate.durationMin}분 기준
          </span>
          <span className="text-[26px] font-extrabold">
            {mate.price.toLocaleString("ko-KR")}원
          </span>
        </div>
        <p className="mt-1 text-right text-[14px] text-ink-400">{priceLabel(mate)}</p>
      </section>

      <RequestForm
        mateId={mate.id}
        mateName={mate.name}
        activityId={activity.id}
        activityLabel={activity.label}
        district={flow.district}
        date={flow.date}
        dateText={dateLabel(flow.date)}
        slot={flow.slot}
        slotText={slotLabel(flow.slot)}
        price={mate.price}
        durationMin={mate.durationMin}
      />
    </main>
  );
}
