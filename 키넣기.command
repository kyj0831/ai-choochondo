#!/bin/zsh
# AI 추천도 진단 — API 키 설정 (더블클릭 실행용, macOS)
#
# 터미널 명령을 몰라도 키를 넣을 수 있게 만든 창구다.
# 키를 붙여넣으면 .env.local에 기록하고, 기존 키가 있으면 교체한다.
# 여러 엔진 키를 한 번에 순서대로 넣을 수 있다 — 근거(출처)가 필요하면
# 최소 Perplexity 키까지는 넣는 걸 권장한다.

cd "$(dirname "$0")"

# .env.local이 없으면 예시 파일에서 만든다
if [ ! -f .env.local ]; then
  cp .env.local.example .env.local 2>/dev/null || touch .env.local
fi

# 인자: 1=env변수명, 2=사람이 읽는 이름, 3=발급 페이지, 4=키 접두사(형식 검증용)
set_key() {
  local VARNAME="$1"
  local LABEL="$2"
  local URL="$3"
  local PREFIX="$4"

  echo ""
  echo "───────────────────────────────────────────────"
  echo "  $LABEL"
  echo "───────────────────────────────────────────────"
  echo "  발급: $URL"
  echo "  (건너뛰려면 그냥 엔터)"
  echo ""
  # -s 로 입력을 화면에 찍지 않는다. 화면 캡처로 키가 노출되는 사고를 막기 위함.
  read -s "KEY?$LABEL 키 붙여넣기 > "
  echo ""

  KEY="${KEY## }"
  KEY="${KEY%% }"

  if [ -z "$KEY" ]; then
    echo "→ 건너뜁니다."
    return
  fi

  if [[ -n "$PREFIX" && "$KEY" != ${PREFIX}* ]]; then
    echo "⚠ 이 키는 보통 '${PREFIX}'로 시작합니다. 다른 키를 잘못 붙여넣은 건 아닌지 확인하세요."
    echo "  그래도 이대로 저장합니다."
  fi

  grep -v "^[[:space:]]*${VARNAME}=" .env.local > .env.local.tmp 2>/dev/null || true
  mv .env.local.tmp .env.local
  echo "${VARNAME}=$KEY" >> .env.local

  local MASKED="${KEY:0:7}...${KEY: -4}"
  echo "✅ 저장됨: $MASKED"
}

echo ""
echo "═══════════════════════════════════════════════"
echo "  AI 추천도 진단 — API 키 설정"
echo "═══════════════════════════════════════════════"
echo ""
echo "필요한 키만 넣으세요. 전부 선택 사항이며, 건너뛰려면 그냥 엔터만"
echo "누르면 됩니다. 나중에 이 파일을 다시 실행해 추가/교체할 수 있습니다."
echo ""
echo "  · OpenAI    — 판정(채점)에 필수. 없으면 데모 모드로 동작합니다."
echo "  · Perplexity — '근거 부록'에 실제 출처 링크가 나오게 하려면 이걸 넣으세요."
echo "                 (다른 AI는 기본적으로 인터넷 검색을 안 해서 출처가 잘 안 붙습니다)"
echo "  · Claude, Gemini — 여러 AI에서 동시에 자동 수집하고 싶을 때 추가로."
echo ""

set_key "OPENAI_API_KEY" "OpenAI (ChatGPT / 판정용, 필수)" "https://platform.openai.com/api-keys" "sk-"
set_key "PERPLEXITY_API_KEY" "Perplexity (근거·출처 링크용, 추천)" "https://www.perplexity.ai/settings/api" "pplx-"
set_key "ANTHROPIC_API_KEY" "Anthropic / Claude (선택)" "https://console.anthropic.com/settings/keys" "sk-ant-"
set_key "GEMINI_API_KEY" "Google Gemini (선택)" "https://aistudio.google.com/apikey" ""

echo ""
echo "저장 위치: $(pwd)/.env.local (이 파일은 깃헙에 올라가지 않습니다)"
echo ""
echo "═══════════════════════════════════════════════"
echo "  다음 단계"
echo "═══════════════════════════════════════════════"
echo ""
echo "  1. 서버가 켜져 있으면 그 창에서 Control + C 로 끄세요"
echo "  2. start.command 를 더블클릭하세요"
echo "  3. '✅ API 키가 확인되었습니다' 가 뜨면 성공입니다"
echo "  4. 증거 수집 화면에서 '엔진 연결 상태'에 방금 넣은 키가 ● 로 표시되는지 확인하세요"
echo "  5. '자동 수집' 버튼으로 진단하면 근거 부록에 출처가 채워집니다"
echo ""
read -r "?엔터를 누르면 창이 닫힙니다..."
