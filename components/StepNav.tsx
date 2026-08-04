"use client";

const STEPS = [
  { key: "setup", label: "1. 기본 정보" },
  { key: "queries", label: "2. 질문 세트" },
  { key: "evidence", label: "3. 증거 수집" },
  { key: "report", label: "4. 결과 리포트" },
];

export default function StepNav({ current }: { current: "setup" | "queries" | "evidence" | "report" }) {
  const idx = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-2 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.key} className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
              i === idx
                ? "bg-brand-500 text-white"
                : i < idx
                ? "bg-brand-100 text-brand-700"
                : "bg-slate-100 text-slate-400"
            }`}
          >
            {s.label}
          </div>
          {i < STEPS.length - 1 && <div className={`h-px w-6 ${i < idx ? "bg-brand-300" : "bg-slate-200"}`} />}
        </div>
      ))}
    </div>
  );
}
