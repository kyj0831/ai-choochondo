"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SLOTS } from "@/lib/heyday/data";
import { addDays, formatDate, href, type Flow } from "@/lib/heyday/flow";
import type { SlotKey } from "@/lib/heyday/types";

/**
 * 날짜·시간 선택.
 *
 * 달력을 먼저 펴지 않는다. 실제로 가장 많이 고르는 것은 오늘과 내일이고,
 * 달력은 그 두 개로 안 될 때만 필요하다.
 */
export default function WhenPicker({ flow, today }: { flow: Flow; today: string }) {
  const tomorrow = addDays(today, 1);
  const [date, setDate] = useState<string>(flow.date ?? "");
  const [custom, setCustom] = useState(
    Boolean(flow.date && flow.date !== today && flow.date !== tomorrow)
  );
  const [slot, setSlot] = useState<SlotKey | "">(flow.slot ?? "");
  const router = useRouter();

  const quick = [
    { value: today, label: "오늘", sub: formatDate(today) },
    { value: tomorrow, label: "내일", sub: formatDate(tomorrow) },
  ];

  return (
    <div>
      <h2 className="hd-label mt-6 text-[19px]">어느 날이 좋으세요?</h2>
      <div className="grid grid-cols-3 gap-2">
        {quick.map((q) => (
          <button
            key={q.value}
            type="button"
            onClick={() => {
              setDate(q.value);
              setCustom(false);
            }}
            className={`hd-card px-3 py-4 text-center ${
              !custom && date === q.value ? "hd-card-selected" : ""
            }`}
          >
            <span className="block text-[18px] font-bold">{q.label}</span>
            <span className="mt-0.5 block text-[13px] text-ink-400">{q.sub}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`hd-card px-3 py-4 text-center ${custom ? "hd-card-selected" : ""}`}
        >
          <span className="block text-[18px] font-bold">다른 날</span>
          <span className="mt-0.5 block text-[13px] text-ink-400">직접 고르기</span>
        </button>
      </div>

      {custom && (
        <input
          type="date"
          className="hd-input mt-3"
          min={today}
          max={addDays(today, 60)}
          value={date && date !== today && date !== tomorrow ? date : ""}
          onChange={(e) => setDate(e.target.value)}
          aria-label="만날 날짜"
        />
      )}

      <h2 className="hd-label mt-8 text-[19px]">몇 시쯤이 좋으세요?</h2>
      <div className="space-y-3">
        {SLOTS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSlot(s.key)}
            className={`hd-card flex items-center justify-between ${
              slot === s.key ? "hd-card-selected" : ""
            }`}
          >
            <span>
              <span className="block text-[19px] font-bold">{s.label}</span>
              <span className="mt-0.5 block text-[15px] text-ink-500">{s.hint}</span>
            </span>
            {slot === s.key && (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden className="text-heyday-500">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        ))}
      </div>

      <div className="sticky bottom-0 mt-8 -mx-5 border-t border-sand-200 bg-sand-50/95 px-5 py-4 backdrop-blur">
        <button
          type="button"
          className="hd-btn-primary"
          disabled={!date || !slot}
          onClick={() =>
            router.push(
              href("/heyday/where", flow, { date, slot: slot as SlotKey })
            )
          }
        >
          {date && slot ? "다음" : "날짜와 시간을 골라주세요"}
        </button>
      </div>
    </div>
  );
}
