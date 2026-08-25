#!/bin/zsh
# AI 추천도 진단 — 더블클릭 실행용 스크립트 (macOS)
cd "$(dirname "$0")"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm을 찾을 수 없습니다. https://nodejs.org 에서 Node.js를 설치해주세요."
  read -r "?엔터를 누르면 종료합니다..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 의존성을 설치합니다 (최초 1회)..."
  npm install
fi

# 손상된 빌드 캐시로 인한 실행 실패를 방지 (몇 초 걸리지만 항상 깨끗하게 시작)
rm -rf .next

# 키가 없으면 앱이 조용히 데모(샘플) 모드로 돌아간다. 그 사실을 모른 채 나온
# 리포트를 진짜 진단으로 오해하는 사고가 실제로 있었으므로, 시작 시점에 알린다.
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local 2>/dev/null
fi

if ! grep -qE '^\s*(OPENAI_API_KEY|ANTHROPIC_API_KEY)\s*=\s*(sk-|sk-ant-)' .env.local 2>/dev/null; then
  echo ""
  echo "⚠️  데모(샘플) 모드로 실행됩니다 — 실제 AI 진단이 아닙니다."
  echo ""
  echo "   실제 AI로 진단하려면 API 키가 필요합니다:"
  echo "   1) 키 발급  →  https://platform.openai.com/api-keys"
  echo "   2) 이 폴더의 '.env.local' 파일을 텍스트편집기로 열기"
  echo "   3) OPENAI_API_KEY=sk-... 줄에 본인 키를 붙여넣고 저장"
  echo "   4) 이 창에서 Ctrl+C로 끄고 start.command를 다시 실행"
  echo ""
  echo "   (데모 모드로 만든 리포트에는 표지에 경고가 찍히며, 고객에게 전달하면 안 됩니다.)"
  echo ""
else
  echo "✅ API 키가 확인되었습니다 — 실제 AI 진단 모드로 실행합니다."
fi

echo "🚀 서버를 시작합니다. 브라우저에서 http://localhost:3000 을 여세요."
echo "   (종료하려면 이 창에서 Ctrl+C)"
sleep 2 && open "http://localhost:3000" &
npm run dev
