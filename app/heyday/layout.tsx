import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "HeyDay — 오늘 뭐 해보고 싶으세요?",
  description:
    "배우고 싶은 것, 만들고 싶은 것이 생겼을 때 검증된 메이트를 직접 골라 부르는 온디맨드 플랫폼. 서울 전 지역.",
};

// 모바일 우선. 확대를 막지 않는다 —
// 글자를 키우는 것은 5060 사용자가 가장 자주 쓰는 기능이다.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function HeydayLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="hd-page">
      <div className="mx-auto w-full max-w-[480px] px-5 pb-16 pt-4">{children}</div>
    </div>
  );
}
