const STYLES: Record<string, string> = {
  good: "bg-emerald-100 text-emerald-700",
  meh: "bg-amber-100 text-amber-700",
  needs_work: "bg-orange-100 text-orange-700",
  risk: "bg-red-100 text-red-700",
  unknown: "bg-slate-100 text-slate-500",
};

const LABELS: Record<string, string> = {
  good: "좋음",
  meh: "아쉬움",
  needs_work: "보완 필요",
  risk: "위험",
  unknown: "확인 불가",
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STYLES[status] || STYLES.unknown}`}>{LABELS[status] || status}</span>;
}
