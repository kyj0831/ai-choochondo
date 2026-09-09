"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "로그인에 실패했습니다.");
      setBusy(false);
      return;
    }

    // 미들웨어가 붙여준 next 파라미터로 돌아간다.
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") ? next : "/";
  }

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 px-5">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-bold mb-1">운영자 로그인</h1>
        <p className="text-sm text-slate-500 mb-6">전체 진단 목록을 보는 운영자 화면입니다. 사장님은 로그인 없이 자기 진단을 쓸 수 있습니다.</p>

        <label className="label" htmlFor="password">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="input mb-3"
        />

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={busy || !password} className="btn-primary w-full">
          {busy ? "확인 중..." : "들어가기"}
        </button>

        <p className="mt-5 text-xs text-slate-400">
          진단 만들기와 내 진단 보기는 비밀번호가 필요 없습니다. 대시보드로 돌아가세요.
        </p>
      </form>
    </div>
  );
}
