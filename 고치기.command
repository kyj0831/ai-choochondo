#!/bin/zsh
# AI 추천도 진단 — 실행 권한 복구 + 서버 다시 켜기 (더블클릭 실행용, macOS)
#
# .command 파일을 채팅·브라우저로 낱개로 받으면 실행 권한(x)이 사라진다.
# 그 상태로 더블클릭하면 macOS가 "적절한 접근 권한이 없기 때문에 실행할 수
# 없습니다"라고 막는다. 이 파일은 진단 폴더 안의 모든 .command 파일에 권한을
# 되돌려 주고, 격리 표시(quarantine)도 벗긴 뒤, 서버를 새 키로 다시 켠다.

for L in en_US.UTF-8 ko_KR.UTF-8 C.UTF-8 C.utf8; do
  if locale -a 2>/dev/null | grep -qix "$L"; then
    export LC_ALL="$L" LANG="$L"
    break
  fi
done

cd "$(dirname "$0")"

pause_exit() {
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit "${1:-1}"
}

echo ""
echo "═══════════════════════════════════════════════"
echo "  AI 추천도 진단 — 고치기"
echo "═══════════════════════════════════════════════"

# ── 1. 진단 폴더 찾기 ───────────────────────────────────────────
TARGET=""
if [ -f ./start.command ] && [ -f ./package.json ]; then
  TARGET="$(pwd)"
else
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
      -not -path '*/node_modules/*' \
      -not -path '*/Library/*' \
      -not -path '*/Pictures/*' \
      -not -path '*.photoslibrary/*' 2>/dev/null)
  done

  if [ ${#CANDIDATES[@]} -eq 0 ]; then
    echo ""
    echo "❌ 진단 폴더를 찾지 못했습니다. (start.command 가 있는 폴더)"
    pause_exit 1
  fi

  # 여러 개면 키(.env.local)가 있는 쪽, 그중에서도 최근에 쓴 쪽을 고른다.
  BEST=""
  BEST_SCORE=-1
  for d in $CANDIDATES; do
    score=0
    [ -f "$d/.env.local" ] && score=$((score + 10))
    [ -f "$d/data/app.sqlite" ] && score=$((score + 5))
    [ -d "$d/node_modules" ] && score=$((score + 1))
    if [ "$score" -gt "$BEST_SCORE" ]; then
      BEST_SCORE=$score
      BEST="$d"
    fi
  done
  TARGET="$BEST"
  echo "  → $TARGET"
fi

cd "$TARGET" || { echo "❌ 폴더로 이동하지 못했습니다."; pause_exit 1; }

# ── 2. 실행 권한 복구 + 격리 해제 ───────────────────────────────
echo ""
echo "▸ .command 파일들의 실행 권한을 되돌립니다..."
n=0
for f in ./*.command(N); do
  chmod +x "$f" 2>/dev/null && n=$((n + 1))
  # 브라우저로 받은 파일에 붙는 격리 표시. 남아 있으면 더블클릭할 때마다
  # "확인되지 않은 개발자" 경고가 뜬다.
  xattr -d com.apple.quarantine "$f" 2>/dev/null
  echo "   ✓ ${f:t}"
done
echo "  → ${n}개 파일 복구"

if [ ! -f ./start.command ]; then
  echo "❌ start.command 가 없습니다. 폴더가 손상된 것 같습니다."
  pause_exit 1
fi

# ── 3. 예전 서버 끄기 (확실히 죽을 때까지) ─────────────────────
free_port_3000() {
  command -v lsof >/dev/null 2>&1 || return 0
  local tries=0 pids
  while true; do
    pids=$(lsof -ti tcp:3000 2>/dev/null)
    [ -z "$pids" ] && return 0
    tries=$((tries + 1))
    [ "$tries" -gt 12 ] && return 1
    if [ "$tries" -le 3 ]; then
      echo "$pids" | xargs kill 2>/dev/null
    else
      echo "$pids" | xargs kill -9 2>/dev/null
    fi
    sleep 1
  done
}

if command -v lsof >/dev/null 2>&1 && [ -n "$(lsof -ti tcp:3000 2>/dev/null)" ]; then
  echo ""
  echo "▸ 예전 키로 돌고 있던 서버를 끕니다..."
  if ! free_port_3000; then
    echo "⚠️  서버를 끄지 못했습니다. 맥을 다시 시작한 뒤 start.command 를 더블클릭해주세요."
    pause_exit 1
  fi
  echo "  → 껐습니다"
fi

# ── 4. 새 키로 다시 켜기 ────────────────────────────────────────
echo ""
echo "✅ 고치기 끝. 이어서 서버를 켭니다. 이 창은 끄지 마세요."
echo "   '✅ API 키가 확인되었습니다' 가 뜨면 성공입니다."
echo ""
exec zsh ./start.command
