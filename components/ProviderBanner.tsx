"use client";

import { useEffect, useState } from "react";

interface Storage {
  dbPath: string;
  hasExplicitDir: boolean;
  isProduction: boolean;
  ephemeral: boolean;
  projectCount: number;
}

/**
 * 화면 맨 위 경고 띠.
 *
 * 두 가지를 알린다:
 * ① 데모 모드 — 리포트가 실제 AI 분석이 아니라는 사실
 * ② 저장소 휘발 — 재배포하면 데이터가 사라지는 상태
 *
 * ②를 넣은 이유: "진단 목록이 다 비었다"는 사고가 실제로 있었는데, 화면만 봐서는
 * 처음 쓰는 것인지 날아간 것인지 구분할 수 없었다. 날아갈 수 있는 상태라면
 * 비기 전에 미리 말해야 한다.
 */
export default function ProviderBanner() {
  const [provider, setProvider] = useState<string | null>(null);
  const [storage, setStorage] = useState<Storage | null>(null);
  const [noAdmin, setNoAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        setProvider(d.provider);
        setStorage(d.storage ?? null);
        setNoAdmin(!!d.storage?.isProduction && d.adminConfigured === false);
      })
      .catch(() => {});
  }, []);

  return (
    <>
      {storage?.ephemeral && (
        <div className="bg-red-50 border-b border-red-200 text-red-800 text-xs text-center py-2 px-4">
          <span className="font-semibold">저장 볼륨이 연결되지 않았습니다 — 다시 배포하면 진단·리포트·발행한 허브가 모두 사라집니다.</span>{" "}
          배포 설정에서 볼륨을 <code className="font-mono bg-red-100 px-1 py-0.5 rounded">/data</code>에 마운트하고 환경변수{" "}
          <code className="font-mono bg-red-100 px-1 py-0.5 rounded">DATA_DIR=/data</code>를 설정하세요.
        </div>
      )}

      {noAdmin && (
        <div className="bg-red-50 border-b border-red-200 text-red-800 text-xs text-center py-2 px-4">
          <span className="font-semibold">운영자 비밀번호(APP_PASSWORD)가 없습니다.</span> 이 상태에서는 소유 키 없는 옛 진단이
          누구에게나 보이고, 전체 목록을 볼 운영자도 없습니다. 배포 설정에서 APP_PASSWORD 를 지정하세요.
        </div>
      )}

      {provider === "mock" && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs text-center py-2 px-4">
          데모 모드로 동작 중입니다 — 질문 생성·판정·리포트가 샘플 로직으로 채워집니다.{" "}
          <span className="font-semibold">.env.local에 OPENAI_API_KEY 또는 ANTHROPIC_API_KEY를 넣으면</span> 실제 AI 분석이
          활성화됩니다.
        </div>
      )}
    </>
  );
}
