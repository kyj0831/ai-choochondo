"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * "내 진단 링크" — 진단 화면 어디서든 보인다.
 *
 * 진단은 만든 브라우저의 쿠키로만 열린다. 쿠키를 지우거나 다른 기기로 가면 못 찾는다.
 * 그래서 처음부터 저장할 링크를 눈앞에 둔다. 카톡 '나에게 보내기'에 넣어두면 끝이다.
 * 이 링크는 그 진단 하나만 연다 — 다른 진단의 권한은 딸려가지 않는다.
 */
export default function OwnerLink() {
  const params = useParams<{ id: string }>();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!params?.id) return;
    fetch(`/api/projects/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLink(d?.ownerLink ?? null))
      .catch(() => {});
  }, [params?.id]);

  if (!link) return null;
  const full = typeof window !== "undefined" ? `${window.location.origin}${link}` : link;

  async function copy() {
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드가 막힌 환경이면 사용자가 직접 긁어 복사할 수 있게 링크를 그대로 둔다.
    }
  }

  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-slate-50 px-4 py-2.5 text-xs ring-1 ring-slate-200">
      <span className="font-semibold text-slate-700">🔗 내 진단 링크</span>
      <span className="text-slate-500">
        다른 기기에서 열거나 나중에 다시 오려면 이 링크를 저장하세요. 카톡 &lsquo;나에게 보내기&rsquo;가 편합니다.
      </span>
      <button onClick={copy} className="btn-ghost !py-1 !px-2.5 !text-xs shrink-0">
        {copied ? "복사됨 ✓" : "링크 복사"}
      </button>
    </div>
  );
}
