import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 추천도 진단",
  description: "브랜드·가게·강사의 AI 검색·추천 노출을 진단하고 개선 액션을 제공합니다.",
};

/**
 * 루트 레이아웃은 의도적으로 비어 있다.
 * 앱 화면의 헤더·네비게이션은 (app) 라우트 그룹 레이아웃에만 둔다.
 * 공개 허브(/p/*)는 AI 크롤러가 읽는 페이지이므로, 브랜드 정보 외의
 * 서비스 UI 마크업이 HTML에 섞이지 않아야 한다.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
