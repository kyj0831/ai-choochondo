import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "BIBL — 감은 쌓는 것",
  description: "잘 터진 유튜브 영상을 찾고, 왜 잘됐는지 해부하고, 내 버전으로 바꿔 쓰는 레퍼런스 보관함",
};

export default function BiblLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/bibl" className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-stone-900">
              BIBL<span className="text-orange-500">.</span>
            </span>
            <span className="hidden text-xs text-stone-400 sm:inline">감은 타고나는 게 아니라 쌓는 것</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm font-semibold">
            <Link href="/bibl" className="rounded-lg px-3 py-2 text-stone-600 hover:bg-stone-100">영상 찾기</Link>
            <Link href="/bibl/library" className="rounded-lg bg-stone-900 px-3 py-2 text-white hover:bg-stone-700">내 보관함</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
