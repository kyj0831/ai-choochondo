"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EntityType } from "@/lib/types";

const ENTITY_TYPES: EntityType[] = ["개인 브랜드/강사", "자영업/로컬", "기업/제품", "전문 서비스"];

export default function NewProjectPage() {
  const router = useRouter();
  const [brandName, setBrandName] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("개인 브랜드/강사");
  const [region, setRegion] = useState("대한민국");
  const [language, setLanguage] = useState("한국어");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_name: brandName.trim(), entity_type: entityType, region, language, categories: [], audiences: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "생성 실패");
      router.push(`/projects/${data.project.id}/setup`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">우리 회사가 AI에게 제대로 추천될까요?</h1>
        <p className="text-slate-500 mt-2">회사·개인 브랜드·가게·강사의 AI 검색·추천 노출을 진단합니다.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label">회사·개인 브랜드·가게·강사 이름 *</label>
          <input
            className="input"
            placeholder="예: 김연지, 서울커피랩, ㈜테크노바"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="label">엔터티 유형</label>
          <div className="grid grid-cols-2 gap-2">
            {ENTITY_TYPES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setEntityType(t)}
                className={`rounded-lg border px-3 py-2 text-sm text-left transition ${
                  entityType === t ? "border-brand-500 bg-brand-50 text-brand-700 font-semibold" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">주요 활동 지역</label>
            <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>
          <div>
            <label className="label">언어</label>
            <input className="input" value={language} onChange={(e) => setLanguage(e.target.value)} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full !py-3 text-base">
          {loading ? "생성 중..." : "AI 추천도 진단하기"}
        </button>

        <p className="text-xs text-slate-400 text-center leading-relaxed">
          결과는 특정 시점·질의·모델에 기반한 관측치이며, 추천이나 검색 순위를 보장하지 않습니다.
        </p>
      </form>
    </div>
  );
}
