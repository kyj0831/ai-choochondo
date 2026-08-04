"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Project } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "초안",
  setup: "설정 중",
  queries: "질문 편집 중",
  evidence: "증거 수집 중",
  analyzed: "진단 완료",
};

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">프로젝트 대시보드</h1>
          <p className="text-sm text-slate-500 mt-1">브랜드별 AI 추천도 진단 현황을 확인하세요.</p>
        </div>
        <Link href="/new" className="btn-primary">
          + AI 추천도 진단하기
        </Link>
      </div>

      {projects === null && <p className="text-slate-400 text-sm">불러오는 중...</p>}

      {projects && projects.length === 0 && (
        <div className="card p-12 text-center">
          <p className="text-slate-500 mb-4">아직 진단한 프로젝트가 없습니다.</p>
          <Link href="/new" className="btn-primary">
            첫 진단 시작하기
          </Link>
        </div>
      )}

      {projects && projects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={
                p.status === "analyzed"
                  ? `/projects/${p.id}/report`
                  : p.status === "evidence"
                  ? `/projects/${p.id}/evidence`
                  : p.status === "queries"
                  ? `/projects/${p.id}/queries`
                  : `/projects/${p.id}/setup`
              }
              className="card p-5 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="badge bg-slate-100 text-slate-600">{STATUS_LABEL[p.status] || p.status}</span>
                <span className="text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
              </div>
              <h2 className="text-lg font-bold">{p.brand_name}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {p.entity_type} · {p.region}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
