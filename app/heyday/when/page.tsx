import { redirect } from "next/navigation";
import TopBar from "@/components/heyday/TopBar";
import Track from "@/components/heyday/Track";
import WhenPicker from "@/components/heyday/WhenPicker";
import { activityById } from "@/lib/heyday/data";
import { href, readFlow, seoulToday } from "@/lib/heyday/flow";

// 오늘 날짜가 기준이므로 빌드 시점에 고정되면 안 된다.
export const dynamic = "force-dynamic";

/** Screen 3 — 언제. */
export default function WhenPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const flow = readFlow(searchParams);
  const activity = flow.activity ? activityById(flow.activity) : undefined;
  if (!activity) redirect("/heyday");

  return (
    <main>
      <Track
        event="activity_selected"
        props={{ category: activity.categoryId, activity: activity.id }}
      />
      <TopBar
        backHref={href("/heyday/activity", flow, { activity: undefined })}
        backLabel="이전"
        step={2}
      />

      <p className="mt-5 text-[15px] font-bold text-heyday-600">{activity.label}</p>
      <h1 className="mt-1 text-[28px] font-black leading-snug tracking-tight">
        언제 만날까요?
      </h1>

      <WhenPicker flow={flow} today={seoulToday()} />
    </main>
  );
}
