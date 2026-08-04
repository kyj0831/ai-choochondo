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

echo "🚀 서버를 시작합니다. 브라우저에서 http://localhost:3000 을 여세요."
echo "   (종료하려면 이 창에서 Ctrl+C)"
sleep 2 && open "http://localhost:3000" &
npm run dev
