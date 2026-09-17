import Link from "next/link";
import { activityById, categoryById, mateById } from "@/lib/heyday/data";
import { countBy, funnel, listBookings } from "@/lib/heyday/db";
import { dateLabel, slotLabel } from "@/lib/heyday/flow";

export const dynamic = "force-dynamic";

/**
 * 검증 결과.
 *
 * 관리자 페이지가 아니다(PRD 13장). MVP가 답해야 할 네 가지 질문 —
 * 무엇을 하고 싶은가 / 누구를 고르는가 / 얼마를 내는가 / 다시 부르는가 —
 * 에 해당하는 숫자만 한 화면에 둔다.
 *
 * APP_PASSWORD가 설정된 환경에서는 로그인 뒤에만 열린다(middleware).
 */
export default function InsightsPage() {
  const f = funnel();
  const bookings = listBookings();
  const answered = bookings.filter((b) => b.reuseIntent);
  const wouldReuse = answered.filter((b) => b.reuseIntent === "yes").length;
  const rate = f.sawPrice > 0 ? Math.round((f.requested / f.sawPrice) * 100) : 0;

  const steps = [
    { label: "홈에 들어옴", n: f.visitors },
    { label: "분야를 고름", n: f.pickedCategory },
    { label: "하고 싶은 일을 고름", n: f.pickedActivity },
    { label: "가격을 봄 (메이트 목록)", n: f.sawPrice },
    { label: "메이트 프로필을 봄", n: f.viewedMate },
    { label: "예약을 요청함", n: f.requested },
  ];
  const top = Math.max(...steps.map((s) => s.n), 1);

  const priceBuckets = bookings.reduce<Record<string, number>>((acc, b) => {
    const key = `${Math.floor(b.price / 10000)}만원대`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="pt-6">
      <h1 className="text-[26px] font-black tracking-tight">HeyDay 검증 결과</h1>
      <p className="mt-2 text-[16px] text-ink-500">
        시범 운영 중 쌓인 숫자입니다. 세션 기준으로 셉니다.
      </p>

      <section className="mt-6 rounded-2xl border-2 border-heyday-200 bg-heyday-50 p-5">
        <p className="text-[16px] font-bold text-heyday-700">
          가격을 본 뒤 예약을 요청한 비율
        </p>
        <p className="mt-1 text-[40px] font-black leading-none">{rate}%</p>
        <p className="mt-2 text-[15px] text-ink-500">
          가격을 본 {f.sawPrice}명 중 {f.requested}명이 요청했습니다.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[19px] font-bold">어디서 멈추는가</h2>
        <div className="mt-3 space-y-2">
          {steps.map((s) => (
            <div key={s.label} className="rounded-xl bg-white p-3">
              <div className="flex justify-between text-[15px]">
                <span className="font-semibold">{s.label}</span>
                <span className="font-bold">{s.n}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-sand-200">
                <div
                  className="h-2 rounded-full bg-heyday-400"
                  style={{ width: `${Math.round((s.n / top) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <Ranking
        title="가장 많이 고른 분야"
        rows={countBy("category_selected", "category").map((r) => ({
          label: categoryById(r.value)?.label ?? r.value,
          n: r.n,
        }))}
      />
      <Ranking
        title="가장 많이 고른 활동"
        rows={countBy("activity_selected", "activity").map((r) => ({
          label: activityById(r.value)?.label ?? r.value,
          n: r.n,
        }))}
      />
      <Ranking
        title="가장 많이 본 메이트"
        rows={countBy("mate_viewed", "mate").map((r) => ({
          label: mateById(r.value)?.name ?? r.value,
          n: r.n,
        }))}
      />
      <Ranking
        title="실제로 요청받은 메이트"
        rows={countBy("booking_requested", "mate").map((r) => ({
          label: mateById(r.value)?.name ?? r.value,
          n: r.n,
        }))}
      />
      <Ranking
        title="요청된 가격대"
        rows={Object.entries(priceBuckets)
          .map(([label, n]) => ({ label, n }))
          .sort((a, b) => b.n - a.n)}
      />

      <section className="mt-8">
        <h2 className="text-[19px] font-bold">또 부르겠다는 답</h2>
        <p className="mt-2 text-[16px] text-ink-500">
          {answered.length === 0
            ? "아직 답변이 없습니다."
            : `답한 ${answered.length}명 중 ${wouldReuse}명이 "또 부르고 싶다"를 골랐습니다.`}
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-[19px] font-bold">예약 요청 {bookings.length}건</h2>
        <div className="mt-3 space-y-2">
          {bookings.length === 0 && (
            <p className="text-[16px] text-ink-500">아직 요청이 없습니다.</p>
          )}
          {bookings.map((b) => (
            <div key={b.id} className="rounded-xl bg-white p-4 text-[15px]">
              <p className="font-bold">
                {activityById(b.activityId)?.label} · {mateById(b.mateId)?.name} ·{" "}
                {b.price.toLocaleString("ko-KR")}원
              </p>
              <p className="mt-1 text-ink-500">
                {dateLabel(b.date)} {slotLabel(b.slot)} · {b.district} · {b.guestName}님 ·{" "}
                {maskPhone(b.guestPhone)}
              </p>
              {b.note && <p className="mt-1 text-ink-500">“{b.note}”</p>}
              <p className="mt-1 text-[13px] text-ink-400">
                {b.createdAt} · 재이용 의향 {b.reuseIntent ?? "무응답"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Link href="/heyday" className="hd-btn-secondary mt-9">
        서비스 화면으로
      </Link>
    </main>
  );
}

function Ranking({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-[19px] font-bold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-[16px] text-ink-500">아직 기록이 없습니다.</p>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {rows.map((r) => (
            <li
              key={r.label}
              className="flex justify-between rounded-xl bg-white px-4 py-2.5 text-[16px]"
            >
              <span>{r.label}</span>
              <span className="font-bold">{r.n}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** 연락처는 화면에 그대로 띄우지 않는다. 누가 요청했는지 구분할 만큼만 남긴다. */
function maskPhone(digits: string): string {
  if (digits.length < 8) return "***";
  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}
