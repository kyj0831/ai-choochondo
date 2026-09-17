import Link from "next/link";
import { redirect } from "next/navigation";
import TopBar from "@/components/heyday/TopBar";
import Track from "@/components/heyday/Track";
import { activitiesOf, categoryById } from "@/lib/heyday/data";
import { href, readFlow } from "@/lib/heyday/flow";

/** Screen 2 — 활동 선택. 한 화면에 한 가지 질문만 둔다. */
export default function ActivityPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const flow = readFlow(searchParams);
  const category = flow.category ? categoryById(flow.category) : undefined;
  if (!category) redirect("/heyday");

  const activities = activitiesOf(category.id);

  return (
    <main>
      <Track event="category_selected" props={{ category: category.id }} />
      <TopBar backHref="/heyday" backLabel="처음으로" step={1} />

      <h1 className="mt-5 text-[28px] font-black leading-snug tracking-tight">
        {category.label}
        <br />
        무엇을 해볼까요?
      </h1>
      <p className="mt-2 text-[16px] text-ink-500">{category.priceNote}</p>

      <div className="mt-6 space-y-3">
        {activities.map((a) => (
          <Link
            key={a.id}
            href={href("/heyday/when", flow, { activity: a.id })}
            className="hd-card"
          >
            <span className="block text-[19px] font-bold">{a.label}</span>
            <span className="mt-0.5 block text-[15px] text-ink-500">{a.blurb}</span>
          </Link>
        ))}
      </div>

      <p className="mt-7 text-center text-[15px] text-ink-400">
        찾는 것이 없으면{" "}
        <Link href="/heyday" className="font-bold text-heyday-600 underline">
          다른 분야 보기
        </Link>
      </p>
    </main>
  );
}
