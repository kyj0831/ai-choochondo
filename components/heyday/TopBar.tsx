import Link from "next/link";

/**
 * 상단 바.
 *
 * 뒤로가기는 브라우저 기능에 맡기지 않고 화면에 항상 크게 둔다(PRD 15장).
 * 어디로 돌아가는지도 글자로 적는다 — 화살표만으로는 어디로 가는지 모른다.
 */
export default function TopBar({
  backHref,
  backLabel,
  step,
  total = 5,
}: {
  backHref: string;
  backLabel: string;
  step?: number;
  total?: number;
}) {
  return (
    <div className="sticky top-0 z-10 -mx-5 mb-2 border-b border-sand-200 bg-sand-50/95 px-5 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-2 -ml-2 text-[16px] font-bold text-ink-700 hover:bg-sand-100"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 19l-7-7 7-7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {backLabel}
        </Link>
        {step && (
          <span className="text-[15px] font-bold text-ink-400">
            {step} / {total}
          </span>
        )}
      </div>
    </div>
  );
}
