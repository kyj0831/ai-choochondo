import Link from "next/link";
import { requireProject } from "@/lib/owner";

/**
 * /projects/{id}/* 전체의 문지기.
 *
 * 화면들은 클라이언트 컴포넌트라 API 가 404 를 주면 "불러오는 중..." 에서 멈춘다.
 * 여기서 서버 단계에 막아 사람이 읽는 안내를 대신 보여준다.
 * 없는 진단과 권한 없는 진단을 같은 화면으로 처리한다 — 존재 여부를 흘리지 않는다.
 */
export default async function ProjectGate({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const project = await requireProject(params.id);
  if (project) return <>{children}</>;

  return (
    <div className="max-w-lg mx-auto">
      <div className="card p-8">
        <h1 className="text-xl font-bold mb-3">이 진단을 열 수 없습니다</h1>
        <p className="text-sm leading-relaxed text-slate-600 mb-6">
          진단은 <strong className="text-slate-800">만든 브라우저</strong>와{" "}
          <strong className="text-slate-800">저장해둔 링크</strong>로만 열립니다. 아래 중 하나일 가능성이 높습니다.
        </p>
        <ul className="space-y-3 mb-7 text-sm text-slate-600">
          <li>
            <strong className="text-slate-800">· 다른 기기나 다른 브라우저입니다.</strong> 진단을 만들 때 받은{" "}
            <em>내 진단 링크</em>로 여세요. 카톡이나 메모에 저장해둔 그 링크입니다.
          </li>
          <li>
            <strong className="text-slate-800">· 브라우저 데이터(쿠키)를 지웠습니다.</strong> 마찬가지로 저장해둔 링크로 열면
            다시 연결됩니다.
          </li>
          <li>
            <strong className="text-slate-800">· 링크를 잃어버렸습니다.</strong> 운영자에게 요청하면 다시 보내드릴 수
            있습니다.
          </li>
        </ul>
        <div className="flex flex-wrap gap-2">
          <Link href="/" className="btn-primary inline-block">
            내 진단 목록으로
          </Link>
          <Link href="/login" className="btn-ghost inline-block">
            운영자 로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
