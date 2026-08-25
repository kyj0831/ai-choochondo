#!/bin/zsh
# AI 추천도 진단 — API 키 설정 (더블클릭 실행용, macOS)
#
# 터미널 명령을 몰라도 키를 넣을 수 있게 만든 창구다.
# 키를 붙여넣으면 .env.local에 기록하고, 기존 키가 있으면 교체한다.

cd "$(dirname "$0")"

echo ""
echo "═══════════════════════════════════════════════"
echo "  AI 추천도 진단 — API 키 설정"
echo "═══════════════════════════════════════════════"
echo ""
echo "실제 AI로 진단하려면 OpenAI API 키가 필요합니다."
echo ""
echo "  키 발급:  https://platform.openai.com/api-keys"
echo "  (Create new secret key → 복사)"
echo ""
echo "-----------------------------------------------"
echo "아래에 키를 붙여넣고 엔터를 누르세요."
echo "  · 붙여넣기: Command + V"
echo "  · 화면에 아무것도 안 나타나는 게 정상입니다 (키 보호)"
echo "  · 취소하려면 그냥 엔터"
echo "-----------------------------------------------"
echo ""

# -s 로 입력을 화면에 찍지 않는다. 예전에는 키가 그대로 표시돼,
# 사용자가 화면을 캡처해 공유하는 순간 키가 노출됐다.
read -s "KEY?키 붙여넣기 > "
echo ""

# 앞뒤 공백 제거
KEY="${KEY## }"
KEY="${KEY%% }"

if [ -z "$KEY" ]; then
  echo ""
  echo "입력이 없어 종료합니다. 키 없이 실행하면 데모(샘플) 모드로 동작합니다."
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 0
fi

if [[ "$KEY" != sk-* ]]; then
  echo ""
  echo "❌ 키 형식이 올바르지 않습니다. OpenAI 키는 'sk-' 로 시작합니다."
  echo "   복사가 제대로 됐는지 확인하고 다시 실행해주세요."
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

# .env.local이 없으면 예시 파일에서 만든다
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local 2>/dev/null || touch .env.local
fi

# 기존 OPENAI_API_KEY 줄은 지우고 새로 넣는다(중복 방지).
# macOS sed는 -i 뒤에 확장자 인자를 요구하므로 임시 파일로 처리한다.
grep -v '^[[:space:]]*OPENAI_API_KEY=' .env.local > .env.local.tmp 2>/dev/null || true
mv .env.local.tmp .env.local
echo "OPENAI_API_KEY=$KEY" >> .env.local

# 확인용으로 앞뒤 일부만 보여준다(전체 노출 방지)
MASKED="${KEY:0:7}...${KEY: -4}"

echo ""
echo "✅ 키를 저장했습니다:  $MASKED"
echo "   저장 위치: $(pwd)/.env.local"
echo "   (이 파일은 깃헙에 올라가지 않습니다)"
echo ""
echo "═══════════════════════════════════════════════"
echo "  다음 단계"
echo "═══════════════════════════════════════════════"
echo ""
echo "  1. 서버가 켜져 있으면 그 창에서 Control + C 로 끄세요"
echo "  2. start.command 를 더블클릭하세요"
echo "  3. '✅ API 키가 확인되었습니다' 가 뜨면 성공입니다"
echo "  4. 새 진단을 만드세요 (기존 진단은 데모 결과라 재사용 불가)"
echo ""
read -r "?엔터를 누르면 창이 닫힙니다..."
