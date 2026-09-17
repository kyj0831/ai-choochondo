"use client";

import { useState } from "react";
import { track } from "@/components/heyday/Track";

type Intent = "yes" | "maybe" | "no";

const OPTIONS: { value: Intent; label: string }[] = [
  { value: "yes", label: "네, 또 부르고 싶어요" },
  { value: "maybe", label: "해보고 나서 정할래요" },
  { value: "no", label: "이번 한 번이면 충분해요" },
];

/**
 * 재이용 의향.
 *
 * 만족도를 묻지 않는다 — 아직 만나지 않았기 때문이다.
 * "또 부를 생각이 있는가"만 한 번 묻는다(PRD 17장 Retention 가설).
 */
export default function ReuseIntent({ bookingId }: { bookingId: string }) {
  const [picked, setPicked] = useState<Intent | null>(null);

  async function choose(value: Intent) {
    setPicked(value);
    track("reuse_intent", { intent: value });
    await fetch(`/api/heyday/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reuseIntent: value }),
    }).catch(() => {
      /* 답변 저장 실패가 화면을 막지 않는다 */
    });
  }

  if (picked) {
    return (
      <p className="mt-3 rounded-2xl bg-leaf-50 px-4 py-4 text-[16px] font-bold text-leaf-700">
        답해주셔서 고맙습니다. 더 좋은 메이트를 찾는 데 쓸게요.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => choose(o.value)}
          className="hd-card text-[17px] font-bold"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
