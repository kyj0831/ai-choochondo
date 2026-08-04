import Link from "next/link";
import ProviderBanner from "@/components/ProviderBanner";

/** 진단 서비스 화면(대시보드·진단·리포트)의 공통 껍데기. 공개 허브에는 적용되지 않는다. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ProviderBanner />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-bold text-brand-600">AI 추천도</span>
            <span className="text-xs text-slate-400">GEO/AEO Brand Check</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/" className="btn-ghost">
              대시보드
            </Link>
            <Link href="/new" className="btn-primary !py-2">
              새 진단
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </>
  );
}
