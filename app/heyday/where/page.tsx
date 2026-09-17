import Link from "next/link";
import { redirect } from "next/navigation";
import TopBar from "@/components/heyday/TopBar";
import Track from "@/components/heyday/Track";
import { ALL_DISTRICTS, REGION_GROUPS, activityById, mateCountIn } from "@/lib/heyday/data";
import { dateLabel, href, readFlow, slotLabel } from "@/lib/heyday/flow";

export const dynamic = "force-dynamic";

/**
 * Screen 4 — 어디에서.
 *
 * 서울 25개 구를 한 번에 펼치면 그 자체가 벽이 된다.
 * 그래서 메이트가 실제로 활동하는 동네를 먼저 보여주고,
 * 나머지 전 지역은 접어둔 채로 열어둔다(PRD 11장).
 */
export default function WherePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const flow = readFlow(searchParams);
  const activity = flow.activity ? activityById(flow.activity) : undefined;
  if (!activity || !flow.date || !flow.slot) redirect("/heyday");

  const active = ALL_DISTRICTS.filter((d) => mateCountIn(d, activity.id) > 0);
  const activeSet = new Set(active);

  return (
    <main>
      <Track event="where_viewed" props={{ activity: activity.id }} />
      <TopBar backHref={href("/heyday/when", flow)} backLabel="이전" step={3} />

      <p className="mt-5 text-[15px] font-bold text-heyday-600">
        {activity.label} · {dateLabel(flow.date)} {slotLabel(flow.slot)}
      </p>
      <h1 className="mt-1 text-[28px] font-black leading-snug tracking-tight">
        어디에서 만날까요?
      </h1>
      <p className="mt-2 text-[16px] text-ink-500">
        집 근처나 자주 가는 동네를 고르세요.
      </p>

      <h2 className="hd-label mt-7">메이트가 활동 중인 동네</h2>
      <div className="grid grid-cols-2 gap-2">
        {active.map((d) => (
          <Link
            key={d}
            href={href("/heyday/mates", flow, { district: d })}
            className="hd-card px-4 py-4"
          >
            <span className="block text-[18px] font-bold">{d}</span>
            <span className="mt-0.5 block text-[14px] text-ink-400">
              메이트 {mateCountIn(d, activity.id)}명
            </span>
          </Link>
        ))}
      </div>

      <details className="mt-6 rounded-2xl border-2 border-sand-200 bg-white p-4">
        <summary className="cursor-pointer list-none text-[17px] font-bold">
          서울 전체에서 고르기
          <span className="ml-2 text-[14px] font-medium text-ink-400">
            (25개 자치구)
          </span>
        </summary>
        <div className="mt-4 space-y-5">
          {REGION_GROUPS.map((g) => (
            <div key={g.id}>
              <p className="mb-2 text-[15px] font-bold text-ink-500">{g.label}</p>
              <div className="flex flex-wrap gap-2">
                {g.districts.map((d) => (
                  <Link
                    key={d}
                    href={href("/heyday/mates", flow, { district: d })}
                    className={`rounded-xl border-2 px-3 py-2.5 text-[16px] font-semibold ${
                      activeSet.has(d)
                        ? "border-heyday-200 bg-heyday-50 text-ink-900"
                        : "border-sand-200 bg-white text-ink-500"
                    }`}
                  >
                    {d}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[14px] text-ink-400">
          아직 메이트가 없는 동네는 가까운 동네의 메이트를 보여드립니다.
        </p>
      </details>
    </main>
  );
}
