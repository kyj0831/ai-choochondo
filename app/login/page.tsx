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
        <h1 className="text-xl font-bold mb-1">AI 추천도 진단</h1>
        <p className="text-sm text-slate-500 mb-6">진단 데이터를 보려면 비밀번호가 필요합니다.</p>

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
          공개된 AI 프로필 허브 페이지는 비밀번호 없이 볼 수 있습니다.
        </p>
      </form>
    </div>
  );
}
