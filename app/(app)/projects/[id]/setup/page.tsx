"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import StepNav from "@/components/StepNav";
import { GroundTruthFact, OfficialAsset, Project } from "@/lib/types";

const PLATFORMS = ["공식 사이트", "인스타그램", "유튜브", "블로그/브런치", "네이버지도", "카카오맵", "기타 SNS", "저자/회사 페이지"];

const FACT_FIELDS = [
  { key: "직함/업종", placeholder: "예: AI 커뮤니케이터, 한식당 대표" },
  { key: "지역", placeholder: "예: 서울 종로구" },
  { key: "제공 서비스", placeholder: "예: 기업 강연, AI 활용 컨설팅" },
  { key: "대표 실적", placeholder: "예: 000기업 강연 50회, OO상 수상" },
  { key: "최근 활동", placeholder: "예: 2026년 6월 신간 출간" },
];

export default function SetupPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<OfficialAsset[]>([]);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState("");
  const [audiences, setAudiences] = useState("");
  const [newAssetUrl, setNewAssetUrl] = useState("");
  const [newAssetPlatform, setNewAssetPlatform] = useState(PLATFORMS[0]);
  const [sameNameConflict, setSameNameConflict] = useState(false);
  const [sameNameNote, setSameNameNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Guards against React StrictMode (dev) double-invoking this effect and
  // applying an out-of-order response.
  const loadSeq = useRef(0);

  async function load() {
    const seq = ++loadSeq.current;
    const res = await fetch(`/api/projects/${params.id}`);
    const data = await res.json();
    if (seq !== loadSeq.current) return;
    setProject(data.project);
    setAssets(data.assets);
    setCategories(JSON.parse(data.project.categories).join(", "));
    setAudiences(JSON.parse(data.project.audiences).join(", "));
    setSameNameConflict(!!data.project.same_name_conflict);
    setSameNameNote(data.project.same_name_note || "");
    const factMap: Record<string, string> = {};
    (data.facts as GroundTruthFact[]).forEach((f) => (factMap[f.field] = f.value));
    setFacts(factMap);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function addAsset() {
    if (!newAssetUrl.trim()) return;
    const res = await fetch(`/api/projects/${params.id}/assets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newAssetUrl.trim(), platform: newAssetPlatform }),
    });
    const data = await res.json();
    setAssets((prev) => [...prev, data.asset]);
    setNewAssetUrl("");
  }

  async function removeAsset(assetId: string) {
    await fetch(`/api/projects/${params.id}/assets?assetId=${assetId}`, { method: "DELETE" });
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  }

  async function handleContinue() {
    setError("");
    if (!categories.trim()) {
      setError("대표 카테고리를 최소 1개 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/projects/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: categories.split(",").map((s) => s.trim()).filter(Boolean),
          audiences: audiences.split(",").map((s) => s.trim()).filter(Boolean),
          same_name_conflict: sameNameConflict,
          same_name_note: sameNameNote,
        }),
      });
      const factRows = Object.entries(facts)
        .filter(([, v]) => v && v.trim())
        .map(([field, value]) => ({ field, value }));
      if (factRows.length) {
        await fetch(`/api/projects/${params.id}/ground-truth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facts: factRows }),
        });
      }
      router.push(`/projects/${params.id}/queries`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  }

  if (!project) return <p className="text-slate-400 text-sm">불러오는 중...</p>;

  return (
    <div className="max-w-2xl mx-auto">
      <StepNav current="setup" />
      <h1 className="text-2xl font-bold mb-1">{project.brand_name} · 프로젝트 설정</h1>
      <p className="text-sm text-slate-500 mb-6">공식 채널과 대표 사실을 확인하면 진단 정확도가 높아집니다.</p>

      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-3">대표 카테고리 · 목표 청중</h2>
        <div className="space-y-3">
          <div>
            <label className="label">대표 카테고리 (쉼표로 구분, 1~3개)</label>
            <input className="input" placeholder="예: AI 문해력 강의, 생성형 AI 컨설팅" value={categories} onChange={(e) => setCategories(e.target.value)} />
          </div>
          <div>
            <label className="label">목표 청중 (쉼표로 구분)</label>
            <input className="input" placeholder="예: 기업 임직원, 공공기관" value={audiences} onChange={(e) => setAudiences(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-3">공식·준공식 채널</h2>
        <p className="text-xs text-slate-400 mb-3">공식 사이트, SNS, 지도, 저자/회사 페이지 등을 추가하세요.</p>
        <div className="flex gap-2 mb-3">
          <select className="input w-40" value={newAssetPlatform} onChange={(e) => setNewAssetPlatform(e.target.value)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input className="input" placeholder="https://..." value={newAssetUrl} onChange={(e) => setNewAssetUrl(e.target.value)} />
          <button type="button" onClick={addAsset} className="btn-secondary shrink-0">
            추가
          </button>
        </div>
        <ul className="space-y-2">
          {assets.map((a) => (
            <li key={a.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg px-3 py-2">
              <span>
                <span className="badge bg-brand-100 text-brand-700 mr-2">{a.platform}</span>
                <span className="text-slate-600">{a.url}</span>
              </span>
              <button onClick={() => removeAsset(a.id)} className="text-slate-400 hover:text-red-500 text-xs">
                삭제
              </button>
            </li>
          ))}
          {assets.length === 0 && <li className="text-sm text-slate-400">등록된 채널이 없습니다.</li>}
        </ul>
      </div>

      <div className="card p-6 mb-5">
        <h2 className="font-semibold mb-1">사실 기준선 (Ground Truth)</h2>
        <p className="text-xs text-slate-400 mb-3">AI 설명의 정확도를 판정하는 기준입니다. 확인된 사실만 입력하세요.</p>
        <div className="space-y-3">
          {FACT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="label">{f.key}</label>
              <input
                className="input"
                placeholder={f.placeholder}
                value={facts[f.key] || ""}
                onChange={(e) => setFacts((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="card p-6 mb-5">
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={sameNameConflict} onChange={(e) => setSameNameConflict(e.target.checked)} className="mt-1" />
          <span className="text-sm">
            <span className="font-medium">동명이인·동명 매장 가능성이 있습니다.</span>
            <br />
            <span className="text-slate-400 text-xs">혼동 방지 점수 산정에 반영됩니다.</span>
          </span>
        </label>
        {sameNameConflict && (
          <input
            className="input mt-3"
            placeholder="구분 정보 (예: 지역, 직업, 공식 URL)"
            value={sameNameNote}
            onChange={(e) => setSameNameNote(e.target.value)}
          />
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="flex justify-end">
        <button onClick={handleContinue} disabled={saving} className="btn-primary">
          {saving ? "저장 중..." : "다음: 질문 세트 생성 →"}
        </button>
      </div>
    </div>
  );
}
