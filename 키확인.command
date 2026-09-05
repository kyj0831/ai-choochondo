#!/bin/zsh
# AI 추천도 진단 — 저장된 API 키가 진짜 유효한지 확인 (더블클릭 실행용, macOS)
#
# 앱에서 401이 났을 때 "키가 잘못됐는지"와 "앱이 고장났는지"를 구분한다.
# .env.local에 저장된 키를 OpenAI에 직접 물어보고 결과만 한국어로 알려준다.
# 키 전체는 절대 화면에 찍지 않는다(앞뒤 몇 글자만 보여준다).

cd "$(dirname "$0")"

echo ""
echo "═══════════════════════════════════════════════"
echo "  API 키 검사"
echo "═══════════════════════════════════════════════"

if [ ! -f .env.local ]; then
  echo ""
  echo "❌ .env.local 파일이 없습니다. 먼저 '키넣기.command'를 실행하세요."
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

# 마지막에 기록된 OPENAI_API_KEY 줄을 읽는다(키넣기.command가 항상 맨 뒤에 붙인다).
KEY=$(grep -E '^[[:space:]]*OPENAI_API_KEY[[:space:]]*=' .env.local 2>/dev/null \
  | tail -1 \
  | sed -E 's/^[^=]*=[[:space:]]*//; s/^["'"'"']//; s/["'"'"']$//')

if [ -z "$KEY" ]; then
  echo ""
  echo "❌ 저장된 OpenAI 키가 없습니다 — 지금은 데모 모드로 동작합니다."
  echo "   '키넣기.command'를 실행해 키를 넣어주세요."
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

MASKED="${KEY:0:11}…${KEY: -4}"
echo ""
echo "저장된 키: $MASKED   (길이 ${#KEY}자)"
echo ""

# ── 붙여넣기 사고 먼저 걸러낸다 ─────────────────────────────────
PROBLEM=0

COUNT=$(printf '%s' "$KEY" | grep -o 'sk-' | wc -l | tr -d ' ')
if [ "$COUNT" -gt 1 ]; then
  echo "🚨 키 안에 'sk-'가 ${COUNT}번 들어 있습니다 — 키가 두 번 붙여넣어졌습니다."
  echo "   입력이 화면에 안 보여서 Command+V를 여러 번 누르면 이렇게 됩니다."
  echo "   → '키넣기.command'를 다시 실행하고 Command+V는 딱 한 번만 누르세요."
  PROBLEM=1
fi

if [[ "$KEY" != sk-* ]]; then
  echo "🚨 키가 'sk-'로 시작하지 않습니다 — OpenAI 키가 아닌 다른 값이 들어갔습니다."
  PROBLEM=1
fi

if [ ${#KEY} -lt 40 ]; then
  echo "🚨 키가 너무 짧습니다 — 복사가 중간에 잘렸을 수 있습니다."
  PROBLEM=1
fi

if [ "$PROBLEM" -eq 1 ]; then
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

# ── OpenAI에 직접 물어본다 ──────────────────────────────────────
echo "OpenAI에 이 키가 유효한지 물어보는 중..."
BODY=$(mktemp)
CODE=$(curl -s -m 20 -o "$BODY" -w '%{http_code}' \
  https://api.openai.com/v1/models \
  -H "Authorization: Bearer $KEY")

echo ""
case "$CODE" in
  200)
    echo "✅ 키가 정상입니다. 이 키로 실제 진단을 돌릴 수 있습니다."
    echo ""
    echo "   그래도 앱에서 401이 뜬다면, 서버가 예전 키로 켜져 있는 겁니다:"
    echo "   서버 창에서 Control + C 로 끄고 start.command를 다시 실행하세요."
    ;;
  401)
    echo "❌ OpenAI가 이 키를 거부했습니다 (401)."
    echo ""
    echo "   이 키는 폐기됐거나 존재하지 않는 키입니다. 흔한 경우:"
    echo "   · 예전에 쓰다 폐기(revoke)한 키를 다시 붙여넣음"
    echo "   · 복사가 잘못돼 글자가 빠지거나 섞임"
    echo ""
    echo "   → https://platform.openai.com/api-keys 에서 'Create new secret key'로"
    echo "     새 키를 발급받아 '키넣기.command'에 다시 넣으세요."
    echo "     (발급 직후 화면에서만 전체가 보입니다. 그때 복사해야 합니다.)"
    echo ""
    echo "   위에 표시된 '$MASKED' 와 OpenAI 사이트의 키 목록을 비교해 보세요."
    ;;
  429)
    echo "⚠️  키는 유효하지만 사용 한도에 걸렸습니다 (429)."
    echo ""
    echo "   대개 결제 잔액이 0원인 경우입니다."
    echo "   → https://platform.openai.com/settings/organization/billing 에서 충전하세요."
    echo "     (5달러면 이 도구로 수백 건 진단 가능합니다)"
    ;;
  000)
    echo "⚠️  인터넷 연결에 실패했습니다. 와이파이를 확인하고 다시 실행하세요."
    ;;
  *)
    echo "⚠️  예상 못 한 응답입니다 (HTTP $CODE)."
    echo ""
    head -c 400 "$BODY"
    echo ""
    ;;
esac
rm -f "$BODY"

echo ""
read -r "?엔터를 누르면 창이 닫힙니다..."
