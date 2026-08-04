"use client";

import { useEffect, useState } from "react";

export default function ProviderBanner() {
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setProvider(d.provider))
      .catch(() => {});
  }, []);

  if (provider !== "mock") return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs text-center py-2 px-4">
      데모 모드로 동작 중입니다 — 질문 생성·판정·리포트가 샘플 로직으로 채워집니다.{" "}
      <span className="font-semibold">.env.local에 OPENAI_API_KEY 또는 ANTHROPIC_API_KEY를 넣으면</span> 실제 AI 분석이
      활성화됩니다.
    </div>
  );
}
