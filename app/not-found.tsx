import Link from "next/link";

/**
 * 앱 전체의 404.
 *
 * 허브(/p/*)에는 전용 안내가 있지만, 그 밖의 경로는 Next.js 기본 화면
 * "404 This page could not be found."가 그대로 떴다. 영문 한 줄이라 사용자에게는
 * 빈 화면이고, 어느 주소를 열었는지도 남지 않아 원인을 찾을 수 없었다.
 * 여기서는 원인 후보와 함께 "주소창을 그대로 복사해 달라"는 요청까지 넣는다 —
 * 그 한 줄이 있어야 다음에 고칠 수 있다.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center px-5 py-14">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">404</p>
          <h1 className="text-xl font-bold text-slate-900 mb-3">이 주소에는 화면이 없습니다</h1>
          <p className="text-sm leading-relaxed text-slate-600 mb-6">아래 중 하나일 가능성이 높습니다.</p>

          <ul className="space-y-3 mb-7 text-sm text-slate-600">
            <li>
              <strong className="text-slate-800">· 주소가 오래됐거나 잘못 입력됐습니다.</strong> 북마크나 예전 메시지의 링크는
              더 이상 맞지 않을 수 있습니다.
            </li>
            <li>
              <strong className="text-slate-800">· 진단 프로젝트가 없습니다.</strong> 다른 폴더나 다른 컴퓨터에서 만든 진단은
              여기 없습니다. 대시보드에서 목록을 확인하세요.
            </li>
            <li>
              <strong className="text-slate-800">· 서버가 예전 코드로 켜져 있습니다.</strong> 업데이트 뒤에는 서버를 끄고{" "}
              <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">start.command</code>를 다시 실행해야
              새 화면이 나옵니다.
            </li>
          </ul>

          <div className="flex flex-wrap gap-2">
            <Link href="/" className="btn-primary inline-block">
              대시보드로
            </Link>
            <Link href="/new" className="btn-ghost inline-block">
              새 진단 시작
            </Link>
          </div>

          <p className="mt-6 text-xs text-slate-400 leading-relaxed">
            계속 이 화면이 나오면 <strong className="text-slate-600">브라우저 주소창의 주소를 그대로 복사</strong>해서 알려주세요.
            어느 경로에서 났는지 알아야 고칠 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
