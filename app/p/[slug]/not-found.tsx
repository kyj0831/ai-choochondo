import Link from "next/link";

/**
 * 허브 주소를 열었는데 보여줄 페이지가 없을 때.
 *
 * 기본 404("This page could not be found.")를 그대로 두면 사장님 입장에서는
 * 화면이 그냥 비어 보인다 — 무엇이 잘못됐는지도, 무엇을 해야 하는지도 알 수 없다.
 * 여기서 가능한 원인을 전부 짚어준다. 가장 흔한 원인이 맨 위다.
 *
 * HTTP 상태는 그대로 404다. 발행되지 않은 주소를 크롤러가 색인하면 안 되기 때문이다.
 */
export default function HubNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 grid place-items-center px-5 py-14">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl bg-white p-8 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">404</p>
          <h1 className="text-xl font-bold text-slate-900 mb-3">아직 공개되지 않은 주소입니다</h1>
          <p className="text-sm leading-relaxed text-slate-600 mb-6">
            이 주소에 공개된 AI 프로필 허브가 없습니다. 아래 중 하나일 가능성이 높습니다.
          </p>

          <ol className="space-y-4 mb-7">
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold grid place-items-center">
                1
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">아직 발행 버튼을 누르지 않았습니다</p>
                <p className="text-sm text-slate-600 leading-relaxed mt-0.5">
                  가장 흔한 경우입니다. 허브는 <strong className="text-slate-800">발행하기</strong>를 눌러야 공개됩니다.
                  편집 화면에서 주소가 먼저 보이더라도, 발행 전에는 이 화면이 나옵니다.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-slate-300 text-white text-xs font-bold grid place-items-center">
                2
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">비공개로 전환했습니다</p>
                <p className="text-sm text-slate-600 leading-relaxed mt-0.5">
                  발행했다가 비공개로 되돌리면 주소는 그대로지만 내용은 내려갑니다.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-slate-300 text-white text-xs font-bold grid place-items-center">
                3
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">주소가 바뀌었거나 오타가 있습니다</p>
                <p className="text-sm text-slate-600 leading-relaxed mt-0.5">
                  편집 화면에서 공개 주소를 바꾸면 이전 주소는 더 이상 열리지 않습니다.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="shrink-0 w-6 h-6 rounded-full bg-slate-300 text-white text-xs font-bold grid place-items-center">
                4
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">서버를 다시 배포하면서 데이터가 초기화됐습니다</p>
                <p className="text-sm text-slate-600 leading-relaxed mt-0.5">
                  배포 환경에서 저장 볼륨(<code className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded">DATA_DIR</code>)을
                  붙이지 않으면 재배포할 때마다 진단·허브가 전부 사라집니다.
                  이 경우 다른 화면도 함께 비어 있습니다.
                </p>
              </div>
            </li>
          </ol>

          <Link href="/" className="btn-primary inline-block">
            내 진단 목록으로
          </Link>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">AI 추천도 — AI 검색 노출·정확도 진단</p>
      </div>
    </div>
  );
}
