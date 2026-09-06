#!/bin/zsh
# AI 추천도 진단 — 한 번에 고치기 (더블클릭 실행용, macOS)
#
# 폴더가 여러 개(ai-choochondo, 2, 3, 4…)라서 "키를 넣은 폴더"와 "서버가 도는
# 폴더"가 달라지는 사고가 났다. 새 키를 넣어도 예전 폴더의 서버가 예전 키로
# 계속 돌았다. 이 파일은 그 혼선을 끝낸다.
#
#   1. 진단 폴더를 전부 찾아 상태를 표로 보여준다 (키·코드 버전·서버 위치)
#   2. "키를 가장 최근에 저장한 폴더"를 고른다 — 사용자가 실제로 쓰는 폴더다
#   3. 그 폴더의 .command 실행 권한을 되돌린다
#   4. 코드가 옛날 것이면 깃헙에서 최신으로 바꾼다 (키·데이터는 그대로)
#   5. 저장된 키를 OpenAI에 직접 물어본다. 거부되면 그 자리에서 새 키를 받는다
#   6. 예전 서버를 확실히 끄고 새 키로 켠다

zmodload zsh/stat 2>/dev/null

for L in en_US.UTF-8 ko_KR.UTF-8 C.UTF-8 C.utf8; do
  if locale -a 2>/dev/null | grep -qix "$L"; then
    export LC_ALL="$L" LANG="$L"
    break
  fi
done

cd "$(dirname "$0")"
REPO_ZIP="https://codeload.github.com/kyj0831/ai-choochondo/zip/refs/heads/main"

pause_exit() { echo ""; read -r "?엔터를 누르면 창이 닫힙니다..."; exit "${1:-1}"; }

# 파일의 수정 시각(초). 없으면 0.
mtime_of() { [ -e "$1" ] && zstat +mtime "$1" 2>/dev/null || echo 0; }

# .env.local 에서 OPENAI_API_KEY 값만 꺼낸다(따옴표·공백 제거). 없으면 빈 문자열.
read_key_from() {
  grep -E '^[[:space:]]*OPENAI_API_KEY[[:space:]]*=' "$1" 2>/dev/null | tail -1 \
    | sed -E 's/^[^=]*=[[:space:]]*//; s/^["'"'"']//; s/["'"'"']$//'
}
mask() { [ ${#1} -gt 15 ] && echo "${1:0:11}…${1: -4}" || echo "(없음)"; }

# 최신 코드인지 판별하는 표식. PR #16 이후 lib/llm.ts 에만 있다.
is_latest_code() { grep -q anchorNameDemand "$1/lib/llm.ts" 2>/dev/null; }

echo ""
echo "═══════════════════════════════════════════════"
echo "  AI 추천도 진단 — 한 번에 고치기"
echo "═══════════════════════════════════════════════"

# ── 1. 폴더 전부 찾기 ───────────────────────────────────────────
echo ""
echo "▸ 진단 폴더를 찾는 중..."
CANDIDATES=()
for base in "$HOME/Downloads" "$HOME/Desktop" "$HOME/Documents"; do
  [ -d "$base" ] || continue
  while IFS= read -r hit; do
    dir="${hit:h}"
    [ -f "$dir/package.json" ] || continue
    [[ " ${CANDIDATES[*]} " == *" $dir "* ]] || CANDIDATES+=("$dir")
  done < <(find "$base" -maxdepth 4 -name start.command \
    -not -path '*/node_modules/*' -not -path '*/Library/*' \
    -not -path '*/Pictures/*' -not -path '*.photoslibrary/*' 2>/dev/null)
done
# 이 파일이 이미 진단 폴더 안에 있으면 그 폴더도 후보에 넣는다.
if [ -f ./start.command ] && [ -f ./package.json ]; then
  here="$(pwd)"
  [[ " ${CANDIDATES[*]} " == *" $here "* ]] || CANDIDATES+=("$here")
fi

if [ ${#CANDIDATES[@]} -eq 0 ]; then
  echo ""
  echo "❌ 진단 폴더를 찾지 못했습니다. (start.command 가 있는 폴더)"
  echo "   zip 을 먼저 풀어주세요."
  pause_exit 1
fi

# 지금 서버가 어느 폴더에서 돌고 있는지 알아낸다.
SERVER_DIR=""
if command -v lsof >/dev/null 2>&1; then
  for pid in $(lsof -ti tcp:3000 2>/dev/null); do
    d=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
    [ -n "$d" ] && { SERVER_DIR="$d"; break; }
  done
fi

echo ""
echo "  찾은 폴더 ${#CANDIDATES[@]}개:"
TARGET=""
TARGET_MTIME=-1
for d in $CANDIDATES; do
  k=$(read_key_from "$d/.env.local")
  m=$(mtime_of "$d/.env.local")
  code="구버전"; is_latest_code "$d" && code="최신"
  srv=""; [ -n "$SERVER_DIR" ] && [ "$SERVER_DIR" = "$d" ] && srv="  ◀ 지금 서버가 여기서 돌고 있음"
  echo ""
  echo "   📁 ${d/#$HOME/~}"
  echo "      키: $(mask "$k")   코드: $code$srv"
  # 키를 가장 최근에 저장한 폴더가 사용자가 실제로 쓰는 폴더다.
  if [ "$m" -gt "$TARGET_MTIME" ]; then
    TARGET_MTIME=$m
    TARGET="$d"
  fi
done

echo ""
echo "  → 키를 가장 최근에 저장한 폴더를 씁니다:"
echo "    ${TARGET/#$HOME/~}"
if [ -n "$SERVER_DIR" ] && [ "$SERVER_DIR" != "$TARGET" ]; then
  echo ""
  echo "  ⚠️  서버는 다른 폴더에서 돌고 있었습니다. 그래서 새 키가 안 먹은 겁니다."
  echo "     그 서버를 끄고 위 폴더에서 다시 켭니다."
fi

cd "$TARGET" || { echo "❌ 폴더로 이동하지 못했습니다."; pause_exit 1; }

# ── 2. 실행 권한 복구 ───────────────────────────────────────────
echo ""
echo "▸ .command 파일들의 실행 권한을 되돌립니다..."
for f in ./*.command(N); do
  chmod +x "$f" 2>/dev/null
  xattr -d com.apple.quarantine "$f" 2>/dev/null
done
echo "  → 완료"

# ── 3. 코드가 옛날 것이면 최신으로 ─────────────────────────────
if ! is_latest_code "$TARGET"; then
  echo ""
  echo "▸ 이 폴더의 코드가 옛날 것입니다. 깃헙에서 최신으로 바꿉니다 (키·데이터는 그대로)..."
  TMP=$(mktemp -d)
  if curl -fsSL -m 180 -o "$TMP/latest.zip" "$REPO_ZIP" \
     && { command -v ditto >/dev/null 2>&1 && ditto -x -k "$TMP/latest.zip" "$TMP" \
          || LC_ALL=en_US.UTF-8 unzip -qo "$TMP/latest.zip" -d "$TMP"; } \
     && [ -f "$TMP/ai-choochondo-main/package.json" ]; then
    for f in "$TMP/ai-choochondo-main"/*(N); do
      b="${f:t}"; [[ "$b" == *'#U'* ]] || continue
      dec=$(printf '%b' "${b//\#U/\\u}"); [ -n "$dec" ] && mv -f "$f" "${f:h}/$dec"
    done
    SELF="${0:t}"
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --exclude .env.local --exclude data --exclude node_modules --exclude .next \
        --exclude "$SELF" "$TMP/ai-choochondo-main/" ./
    else
      ( cd "$TMP/ai-choochondo-main" && tar cf - --exclude ./.env.local --exclude ./data \
        --exclude ./node_modules --exclude ./.next --exclude "./$SELF" . ) | tar xf - -C ./
    fi
    chmod +x ./*.command 2>/dev/null
    echo "  → 코드 교체 완료. 준비물을 설치합니다 (1~3분)..."
    npm install --silent 2>/dev/null || npm install || echo "  ⚠️  설치에 문제가 있었지만 계속 진행합니다."
  else
    echo "  ⚠️  내려받기에 실패했습니다. 코드는 그대로 두고 계속 진행합니다."
  fi
  rm -rf "$TMP"
fi

# ── 4. 키 검증 — 안 되면 그 자리에서 새 키 받기 ─────────────────
# 0=유효, 1=거부(401), 2=인터넷/기타
check_key() {
  local code
  code=$(curl -s -m 20 -o /dev/null -w '%{http_code}' \
    https://api.openai.com/v1/models -H "Authorization: Bearer $1")
  case "$code" in
    200|429) return 0 ;;   # 429는 키는 맞는데 잔액 문제 — 키 자체는 유효
    401) return 1 ;;
    *) return 2 ;;
  esac
}

save_key() {
  [ -f .env.local ] || cp .env.local.example .env.local 2>/dev/null || touch .env.local
  grep -v '^[[:space:]]*OPENAI_API_KEY=' .env.local > .env.local.tmp 2>/dev/null || true
  mv .env.local.tmp .env.local
  echo "OPENAI_API_KEY=$1" >> .env.local
}

ask_new_key() {
  setopt localoptions extendedglob
  local attempt KEY
  for attempt in 1 2 3; do
    echo ""
    echo "───────────────────────────────────────────────"
    echo "  새 OpenAI 키를 붙여넣어 주세요 ($attempt/3)"
    echo "───────────────────────────────────────────────"
    echo "  발급: https://platform.openai.com/api-keys  →  + Create new secret key"
    echo ""
    echo "  ※ 클릭할 필요 없습니다. Command+V 를 \"딱 한 번\" 누르고 엔터."
    echo "  ※ 붙여넣어도 화면에 아무것도 안 보입니다. 정상입니다."
    echo ""
    read -s "KEY?키 > "
    echo ""
    KEY="${KEY##[[:space:]]##}"; KEY="${KEY%%[[:space:]]##}"
    KEY="${KEY#OPENAI_API_KEY=}"; KEY="${KEY##[[:space:]]##}"
    KEY="${KEY#\"}"; KEY="${KEY%\"}"; KEY="${KEY#\'}"; KEY="${KEY%\'}"

    if [ -z "$KEY" ]; then echo "  → 아무것도 입력되지 않았습니다."; continue; fi
    if [[ "$KEY" == *"..."* || ${#KEY} -lt 20 ]]; then
      echo "  ❌ 예시 문구나 너무 짧은 값입니다. 발급 화면의 긴 문자열을 붙여넣어 주세요."; continue
    fi
    local n=$(printf '%s' "$KEY" | grep -o 'sk-' | wc -l | tr -d ' ')
    if [ "$n" -gt 1 ]; then
      echo "  ❌ 키가 ${n}번 이어붙었습니다 (길이 ${#KEY}자). Command+V 를 한 번만 누르세요."; continue
    fi
    echo "  → OpenAI에 확인 중..."
    check_key "$KEY"; local rc=$?
    if [ $rc -eq 0 ]; then
      save_key "$KEY"
      echo "  ✅ 유효한 키입니다. 저장했습니다: $(mask "$KEY")"
      return 0
    elif [ $rc -eq 1 ]; then
      echo "  ❌ OpenAI가 이 키를 거부했습니다. 방금 발급한 키가 맞는지 확인해 주세요."
    else
      echo "  ⚠️  인터넷 연결을 확인할 수 없어 검증은 못 했지만, 일단 저장합니다."
      save_key "$KEY"; return 0
    fi
  done
  return 1
}

echo ""
echo "▸ 저장된 키를 OpenAI에 직접 확인합니다..."
CUR=$(read_key_from .env.local)
if [ -z "$CUR" ]; then
  echo "  → 저장된 키가 없습니다."
  ask_new_key || { echo ""; echo "❌ 유효한 키를 받지 못했습니다. 키를 새로 발급받아 다시 실행해 주세요."; pause_exit 1; }
else
  check_key "$CUR"; rc=$?
  if [ $rc -eq 0 ]; then
    echo "  ✅ 저장된 키가 유효합니다: $(mask "$CUR")"
  elif [ $rc -eq 1 ]; then
    echo "  ❌ 저장된 키 $(mask "$CUR") 는 OpenAI에서 폐기된 키입니다."
    ask_new_key || { echo ""; echo "❌ 유효한 키를 받지 못했습니다. 키를 새로 발급받아 다시 실행해 주세요."; pause_exit 1; }
  else
    echo "  ⚠️  인터넷 연결을 확인할 수 없어 키 검증을 건너뜁니다."
  fi
fi

# ── 5. 예전 서버 끄고 새로 켜기 ─────────────────────────────────
free_port_3000() {
  command -v lsof >/dev/null 2>&1 || return 0
  local tries=0 pids
  while true; do
    pids=$(lsof -ti tcp:3000 2>/dev/null)
    [ -z "$pids" ] && return 0
    tries=$((tries + 1)); [ "$tries" -gt 12 ] && return 1
    if [ "$tries" -le 3 ]; then echo "$pids" | xargs kill 2>/dev/null
    else echo "$pids" | xargs kill -9 2>/dev/null; fi
    sleep 1
  done
}
if command -v lsof >/dev/null 2>&1 && [ -n "$(lsof -ti tcp:3000 2>/dev/null)" ]; then
  echo ""
  echo "▸ 예전 서버를 끕니다..."
  free_port_3000 || { echo "⚠️  서버를 끄지 못했습니다. 맥을 다시 시작한 뒤 이 파일을 다시 실행해 주세요."; pause_exit 1; }
  echo "  → 껐습니다"
fi

[ -f ./start.command ] || { echo "❌ start.command 가 없습니다."; pause_exit 1; }
echo ""
echo "✅ 고치기 끝. 이 폴더에서 새 키로 서버를 켭니다:"
echo "   ${TARGET/#$HOME/~}"
echo "   이 창은 끄지 마세요. 브라우저가 저절로 열립니다."
echo ""
exec zsh ./start.command
