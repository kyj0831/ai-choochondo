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

# 이미 서버가 켜져 있는데 또 실행하면, 아래 rm -rf .next 가 "돌아가고 있는"
# 서버의 빌드 파일을 지워버린다. 그러면 모든 페이지가 404가 나고 브라우저에는
# "missing required error components, refreshing..." 만 뜬다. 실제로 겪은 사고라
# 여기서 먼저 막는다.
if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:3000 >/dev/null 2>&1; then
  echo ""
  echo "ℹ️  서버가 이미 켜져 있습니다. 창을 하나 더 띄우지 않겠습니다."
  echo "   (한 번 더 실행하면 돌아가던 서버가 망가집니다)"
  echo ""
  echo "   브라우저를 열어드릴게요 →  http://localhost:3000"
  echo ""
  echo "   서버를 완전히 새로 시작하려면:"
  echo "   1) 서버가 돌고 있는 터미널 창에서 Control + C"
  echo "   2) 그 다음 start.command 를 다시 더블클릭"
  echo ""
  open "http://localhost:3000"
  read -r "?엔터를 누르면 이 창이 닫힙니다..."
  exit 0
fi

# 손상된 빌드 캐시로 인한 실행 실패를 방지 (몇 초 걸리지만 항상 깨끗하게 시작)
rm -rf .next

# 키가 없으면 앱이 조용히 데모(샘플) 모드로 돌아간다. 그 사실을 모른 채 나온
# 리포트를 진짜 진단으로 오해하는 사고가 실제로 있었으므로, 시작 시점에 알린다.
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local 2>/dev/null
fi

# 키가 "있는 것처럼 보이기만" 하는 경우를 걸러낸다. 예시 파일에 있던
# `OPENAI_API_KEY=sk-...` 를 진짜 키로 오인해 실제 호출을 시도하다
# 401 Incorrect API key 가 났던 사고가 있었다. 여기서는 sk- 로 시작하면서
# 점 세 개(...)가 없고 길이가 30자 이상인 값만 진짜 키로 인정한다.
has_real_key() {
  grep -E '^[[:space:]]*(OPENAI_API_KEY|ANTHROPIC_API_KEY)[[:space:]]*=' .env.local 2>/dev/null \
    | sed -E 's/^[^=]*=[[:space:]]*//; s/^["'"'"']//; s/["'"'"']$//' \
    | grep -qE '^(sk-|sk-ant-)[A-Za-z0-9_-]{27,}$'
}

if ! has_real_key; then
  echo ""
  echo "⚠️  데모(샘플) 모드로 실행됩니다 — 실제 AI 진단이 아닙니다."
  echo ""
  echo "   실제 AI로 진단하려면 API 키가 필요합니다:"
  echo "   1) 키 발급  →  https://platform.openai.com/api-keys"
  echo "   2) 이 폴더의 '.env.local' 파일을 텍스트편집기로 열기"
  echo "   3) OPENAI_API_KEY=sk-... 줄에 본인 키를 붙여넣고 저장"
  echo "   4) 이 창에서 Ctrl+C로 끄고 start.command를 다시 실행"
  echo ""
  echo "   (더 쉬운 방법: 같은 폴더의 '키넣기.command' 를 더블클릭하세요.)"
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
