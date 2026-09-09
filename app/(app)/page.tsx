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
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbPath, setDbPath] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then(async (r) => {
        if (!r.ok) throw new Error(`목록을 불러오지 못했습니다 (HTTP ${r.status}).`);
        return r.json();
      })
      .then((d) => {
        setProjects(d.projects ?? []);
        setIsAdmin(!!d.isAdmin);
      })
      .catch((e) => {
        // 실패를 조용히 삼키면 "불러오는 중..."에서 영영 멈춰 빈 화면처럼 보인다.
        setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다.");
        setProjects([]);
      });

    // 목록이 비었을 때 "어느 파일을 보고 있는지"를 알려주기 위해 저장 위치를 함께 받는다.
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => setDbPath(d.storage?.dbPath ?? null))
      .catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            프로젝트 대시보드
            {isAdmin && (
              <span className="ml-2 align-middle rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-semibold text-white">
                운영자 · 전체 보기
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin ? "모든 진단이 보입니다." : "이 브라우저에서 만든 진단만 보입니다."}
            {!isAdmin && (
              <>
                {" "}
                <Link href="/login" className="underline hover:text-slate-700">
                  운영자 로그인
                </Link>
              </>
            )}
          </p>
        </div>
        <Link href="/new" className="btn-primary">
          + AI 추천도 진단하기
        </Link>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {projects === null && <p className="text-slate-400 text-sm">불러오는 중...</p>}

      {projects && projects.length === 0 && (
        <div className="card p-10">
          <div className="text-center">
            <p className="text-slate-700 font-semibold mb-1">진단 목록이 비어 있습니다.</p>
            <p className="text-sm text-slate-500 mb-6">처음 쓰는 것이라면 정상입니다. 아래로 시작하세요.</p>
            <Link href="/new" className="btn-primary">
              첫 진단 시작하기
            </Link>
          </div>

          {/*
            전에 만든 진단이 있었는데 비어 보이는 경우를 위한 안내.
            원인이 화면상 구분되지 않으므로 가능한 경우를 직접 짚어준다.
          */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <p className="text-xs font-semibold text-slate-500 mb-3">전에 만든 진단이 있는데 안 보인다면</p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <strong className="text-slate-800">· 다른 기기나 브라우저에서 만들었을 수 있습니다.</strong> 진단은 만든
                브라우저에서만 보입니다. 그때 받은 <strong className="text-slate-800">내 진단 링크</strong>로 열면 여기에도
                나타납니다. (내 컴퓨터와 배포 주소는 저장소도 서로 다릅니다.)
              </li>
              <li>
                <strong className="text-slate-800">· 폴더가 바뀌었을 수 있습니다.</strong> 앱을 새로 내려받았다면 이전
                폴더에 데이터가 남아 있습니다. 이전 폴더의 <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">data</code>{" "}
                폴더를 지금 폴더로 옮기면 됩니다.
              </li>
              <li>
                <strong className="text-slate-800">· 재배포로 초기화됐을 수 있습니다.</strong> 배포 환경에서 저장 볼륨을
                붙이지 않으면 다시 배포할 때마다 전부 사라집니다. 이 경우 화면 맨 위에 빨간 경고가 떠 있습니다.
              </li>
            </ul>
            {dbPath && (
              <p className="mt-4 text-xs text-slate-400">
                지금 읽고 있는 저장 파일: <code className="font-mono">{dbPath}</code>
              </p>
            )}
          </div>
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
