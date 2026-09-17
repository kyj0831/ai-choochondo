import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Avatar from "@/components/heyday/Avatar";
import TopBar from "@/components/heyday/TopBar";
import Track from "@/components/heyday/Track";
import { SLOTS, activityById, mateById } from "@/lib/heyday/data";
import {
  availabilityNote,
  dateLabel,
  href,
  priceLabel,
  readFlow,
  slotLabel,
} from "@/lib/heyday/flow";

export const dynamic = "force-dynamic";

const WEEK = [
  { idx: 1, label: "월" },
  { idx: 2, label: "화" },
  { idx: 3, label: "수" },
  { idx: 4, label: "목" },
  { idx: 5, label: "금" },
  { idx: 6, label: "토" },
  { idx: 0, label: "일" },
];

/** Screen 6 — Mate 상세. 고를 근거를 전부 한 화면에 둔다. */
export default function MateDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const flow = readFlow(searchParams);
  const mate = mateById(params.id);
  if (!mate) notFound();
  if (!flow.activity || !flow.date || !flow.slot || !flow.district) {
    redirect("/heyday");
  }

  const chosen = activityById(flow.activity);
  const canDo = mate.activityIds
    .map((id) => activityById(id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  return (
    <main className="pb-24">
      <Track
        event="mate_viewed"
        props={{ mate: mate.id, activity: flow.activity, price: mate.price }}
      />
      <TopBar backHref={href("/heyday/mates", flow)} backLabel="메이트 목록" step={4} />

      <div className="mt-5 flex items-start gap-4">
        <Avatar variant={mate.avatar} size={96} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-black">
            {mate.name} <span className="font-bold text-ink-500">· {mate.age}세</span>
          </h1>
          <p className="mt-1 text-[16px] font-semibold text-heyday-700">{mate.headline}</p>
          <p className="mt-1.5 text-[15px] text-ink-500">
            활동 {mate.sessionCount}회 · ★ {mate.rating.toFixed(1)} · 후기{" "}
            {mate.reviews.length}개
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-heyday-50 p-4">
        <p className="text-[15px] font-bold text-heyday-700">
          {availabilityNote(mate, flow)}
        </p>
        <p className="mt-1 text-[15px] text-ink-500">
          {mate.districts.join(", ")}에서 만날 수 있어요
        </p>
      </div>

      <section className="mt-7">
        <h2 className="text-[19px] font-bold">소개</h2>
        <p className="mt-2 whitespace-pre-line text-[17px] leading-relaxed text-ink-700">
          {mate.intro}
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-[19px] font-bold">전문 분야</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {mate.specialties.map((s) => (
            <span key={s} className="hd-chip">
              {s}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-[19px] font-bold">함께 할 수 있는 일</h2>
        <ul className="mt-3 space-y-2">
          {canDo.map((a) => (
            <li
              key={a.id}
              className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-[16px] ${
                a.id === chosen?.id
                  ? "bg-heyday-50 font-bold text-heyday-700"
                  : "text-ink-700"
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="mt-0.5 shrink-0">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {a.label}
              {a.id === chosen?.id && (
                <span className="ml-auto shrink-0 text-[14px]">고르신 활동</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-7">
        <h2 className="text-[19px] font-bold">가능한 시간</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border-2 border-sand-200 bg-white">
          {WEEK.map(({ idx, label }, i) => {
            const slots = mate.availability[idx] ?? [];
            return (
              <div
                key={idx}
                className={`flex items-center gap-4 px-4 py-3 text-[16px] ${
                  i > 0 ? "border-t border-sand-200" : ""
                }`}
              >
                <span className="w-8 font-bold">{label}</span>
                <span className={slots.length ? "text-ink-700" : "text-ink-400"}>
                  {slots.length
                    ? slots
                        .map((s) => {
                          const def = SLOTS.find((x) => x.key === s);
                          return `${def?.label} (${def?.hint})`;
                        })
                        .join(", ")
                    : "쉬는 날"}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-7">
        <h2 className="text-[19px] font-bold">인증 정보</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {mate.badges.map((b) => (
            <span key={b} className="hd-badge-verified">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {b}
            </span>
          ))}
        </div>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-400">
          HeyDay는 본인 확인, 신원 확인, 인터뷰, 기본교육을 거친 메이트만 소개합니다.
          (시범 서비스 화면입니다)
        </p>
      </section>

      <section className="mt-7">
        <h2 className="text-[19px] font-bold">후기 {mate.reviews.length}개</h2>
        <div className="mt-3 space-y-3">
          {mate.reviews.map((r, i) => (
            <div key={i} className="rounded-2xl border-2 border-sand-200 bg-white p-4">
              <p className="text-[15px] font-bold">
                {r.author} · {r.age}세
                <span className="ml-2 font-semibold text-heyday-600">
                  {"★".repeat(r.rating)}
                </span>
              </p>
              <p className="mt-0.5 text-[14px] text-ink-400">{r.activity}</p>
              <p className="mt-2 text-[16px] leading-relaxed text-ink-700">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7 rounded-2xl border-2 border-sand-200 bg-white p-5">
        <h2 className="text-[19px] font-bold">가격</h2>
        <p className="mt-2 hd-price text-[24px]">{priceLabel(mate)}</p>
        <p className="mt-1 text-[15px] text-ink-500">
          {dateLabel(flow.date)} {slotLabel(flow.slot)} · {flow.district}에서 만나는 기준
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-400">
          지금 결제하지 않습니다. 예약을 요청하면 메이트가 가능 여부를 확인해
          연락드리고, 그때 확정합니다.
        </p>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-sand-200 bg-sand-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-[480px] items-center gap-3 px-5 py-3">
          <div className="shrink-0">
            <p className="text-[13px] text-ink-400">{mate.durationMin}분</p>
            <p className="text-[19px] font-extrabold">
              {mate.price.toLocaleString("ko-KR")}원
            </p>
          </div>
          <Link href={href(`/heyday/request/${mate.id}`, flow)} className="hd-btn-primary flex-1">
            예약 요청하기
          </Link>
        </div>
      </div>
    </main>
  );
}
