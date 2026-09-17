import Link from "next/link";
import { redirect } from "next/navigation";
import MateCard from "@/components/heyday/MateCard";
import TopBar from "@/components/heyday/TopBar";
import Track from "@/components/heyday/Track";
import { activityById } from "@/lib/heyday/data";
import { dateLabel, href, matchMates, readFlow, slotLabel } from "@/lib/heyday/flow";

export const dynamic = "force-dynamic";

/** Screen 5 — Mate 목록. 가격이 처음 공개되는 화면이자 North Star의 분모. */
export default function MatesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const flow = readFlow(searchParams);
  const activity = flow.activity ? activityById(flow.activity) : undefined;
  if (!activity || !flow.date || !flow.slot || !flow.district) redirect("/heyday");

  const matches = matchMates(flow);
  const exact = matches.filter((m) => m.exact);
  const nearby = matches.filter((m) => !m.exact);

  return (
    <main>
      <Track
        event="price_viewed"
        props={{
          category: activity.categoryId,
          activity: activity.id,
          district: flow.district,
          slot: flow.slot,
          matched: exact.length,
        }}
      />
      <TopBar backHref={href("/heyday/where", flow)} backLabel="이전" step={4} />

      <p className="mt-5 text-[15px] font-bold text-heyday-600">
        {activity.label} · {dateLabel(flow.date)} {slotLabel(flow.slot)} · {flow.district}
      </p>
      <h1 className="mt-1 text-[28px] font-black leading-snug tracking-tight">
        {exact.length > 0
          ? `만날 수 있는 메이트 ${exact.length}명`
          : "조건에 꼭 맞는 메이트가 없어요"}
      </h1>
      <p className="mt-2 text-[16px] text-ink-500">
        {exact.length > 0
          ? "마음에 드는 사람을 직접 고르세요. 가격은 만나는 시간 기준입니다."
          : "날짜나 동네를 바꾸면 만날 수 있는 메이트를 아래에 모았어요."}
      </p>

      {exact.length > 0 && (
        <div className="mt-6 space-y-4">
          {exact.map((m) => (
            <MateCard key={m.mate.id} match={m} flow={flow} />
          ))}
        </div>
      )}

      {nearby.length > 0 && (
        <section className="mt-9">
          <h2 className="text-[19px] font-bold">
            시간이나 동네를 조금 바꾸면 만날 수 있어요
          </h2>
          <div className="mt-4 space-y-4">
            {nearby.map((m) => (
              <MateCard key={m.mate.id} match={m} flow={flow} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-9 space-y-3">
        <Link href={href("/heyday/when", flow)} className="hd-btn-secondary">
          날짜·시간 바꾸기
        </Link>
        <Link href={href("/heyday/where", flow)} className="hd-btn-secondary">
          동네 바꾸기
        </Link>
      </div>
    </main>
  );
}
