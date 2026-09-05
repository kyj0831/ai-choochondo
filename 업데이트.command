#!/bin/zsh
# AI 추천도 진단 — 최신 버전으로 업데이트 (더블클릭 실행용, macOS)
#
# 파일을 손으로 옮기다 엉뚱한 폴더에 넣는 사고를 없애기 위한 창구다.
# 이 파일 하나만 더블클릭하면 아래를 순서대로 처리한다.
#   1. 돌아가고 있는 서버를 끈다 (터미널 창을 못 찾아도 된다)
#   2. 깃헙에서 최신 코드를 내려받는다
#   3. API 키(.env.local)와 진단 데이터(data/)는 건드리지 않고 코드만 교체한다
#   4. 서버를 다시 켜고 브라우저를 연다

cd "$(dirname "$0")"

# 한글 파일명(키넣기.command 등)을 다루려면 UTF-8 로케일이 필요하다.
# Finder에서 더블클릭하면 로케일이 비어 있을 수 있는데, 그 상태로 압축을 풀면
# 파일 이름이 "#Ud0a4#Ub123#Uae30.command"처럼 깨진다. 쓸 수 있는 UTF-8 로케일을
# 하나 골라 고정한다.
for L in en_US.UTF-8 ko_KR.UTF-8 C.UTF-8 C.utf8; do
  if locale -a 2>/dev/null | grep -qix "$L"; then
    export LC_ALL="$L" LANG="$L"
    break
  fi
done

REPO_ZIP="https://codeload.github.com/kyj0831/ai-choochondo/zip/refs/heads/main"
SELF="$(basename "$0")"
# 업데이트로 날아가면 안 되는 것들: 키, 진단 데이터, 설치된 패키지, 빌드 캐시,
# 그리고 지금 실행 중인 이 스크립트 자신.
KEEP=(".env.local" "data" "node_modules" ".next" "$SELF")

fail() {
  echo ""
  echo "❌ $1"
  echo "   (기존 파일은 아무것도 건드리지 않았습니다)"
  [ -n "$TMP" ] && rm -rf "$TMP"
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
}

echo ""
echo "═══════════════════════════════════════════════"
echo "  AI 추천도 진단 — 업데이트"
echo "═══════════════════════════════════════════════"

# ── 1. 돌아가는 서버 끄기 ───────────────────────────────────────
if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -ti tcp:3000 2>/dev/null)
  if [ -n "$PIDS" ]; then
    echo ""
    echo "▸ 켜져 있는 서버를 끕니다..."
    echo "$PIDS" | xargs kill 2>/dev/null
    sleep 2
    PIDS=$(lsof -ti tcp:3000 2>/dev/null)
    [ -n "$PIDS" ] && echo "$PIDS" | xargs kill -9 2>/dev/null
  fi
fi

# ── 2. 최신 코드 내려받기 ───────────────────────────────────────
echo ""
echo "▸ 최신 코드를 내려받는 중..."
TMP=$(mktemp -d) || fail "임시 폴더를 만들지 못했습니다."
curl -fsSL -m 120 -o "$TMP/latest.zip" "$REPO_ZIP" \
  || fail "내려받기에 실패했습니다. 인터넷 연결을 확인하고 다시 실행해주세요."
# 압축 해제. 한글 파일명(키넣기.command 등)이 깨지지 않는 방법을 먼저 쓴다.
# unzip은 로케일이 UTF-8이 아니면 한글 이름을 "#Ud0a4#Ub123#Uae30.command" 같은
# 문자열로 바꿔버린다. Finder에서 더블클릭하면 로케일이 없을 수 있어 실제로 위험하다.
# macOS 기본 도구인 ditto는 이 문제가 없다.
if command -v ditto >/dev/null 2>&1; then
  ditto -x -k "$TMP/latest.zip" "$TMP" || fail "압축을 푸는 데 실패했습니다. 다시 실행해주세요."
else
  LC_ALL=en_US.UTF-8 unzip -qo "$TMP/latest.zip" -d "$TMP" \
    || fail "압축을 푸는 데 실패했습니다. 다시 실행해주세요."
fi

# 그래도 이름이 깨졌다면(#Uxxxx 형태) 원래 한글 이름으로 되돌린다.
for f in "$TMP/ai-choochondo-main"/*(N); do
  base="${f:t}"
  [[ "$base" == *'#U'* ]] || continue
  decoded=$(printf '%b' "${base//\#U/\\u}")
  [ -n "$decoded" ] && [ "$decoded" != "$base" ] && mv -f "$f" "${f:h}/$decoded"
done

SRC="$TMP/ai-choochondo-main"
[ -f "$SRC/package.json" ] || fail "내려받은 내용이 예상과 다릅니다. 다시 실행해주세요."

# ── 3. 코드만 교체 ──────────────────────────────────────────────
echo "▸ 코드를 교체합니다 (API 키와 진단 데이터는 그대로 둡니다)..."

copy_tree() {
  local args=()
  if command -v rsync >/dev/null 2>&1; then
    for e in $KEEP; do args+=(--exclude "$e"); done
    rsync -a $args "$SRC/" ./
  elif command -v tar >/dev/null 2>&1; then
    for e in $KEEP; do args+=(--exclude "./$e"); done
    ( cd "$SRC" && tar cf - $args . ) | tar xf - -C ./
  else
    return 1
  fi
}

copy_tree || fail "코드 교체에 실패했습니다."

# 실행 중인 이 스크립트 자신은 마지막에 "이름 바꾸기"로 교체한다.
# 실행 중인 파일을 덮어쓰면 셸이 남은 줄을 잘못 읽어 스크립트가 깨질 수 있는데,
# mv는 새 파일을 만들어 이름만 바꾸므로 지금 돌고 있는 이 실행에는 영향이 없다.
if [ -f "$SRC/$SELF" ]; then
  cp "$SRC/$SELF" "./$SELF.new" && mv -f "./$SELF.new" "./$SELF"
fi

rm -rf "$TMP"
TMP=""
chmod +x ./*.command 2>/dev/null

[ -f ./start.command ] || fail "start.command 를 찾을 수 없습니다. 폴더가 손상된 것 같습니다."

# ── 4. 다시 켜기 ────────────────────────────────────────────────
echo "▸ 필요한 준비물을 확인합니다 (처음이면 몇 분 걸립니다)..."
npm install --silent || npm install || fail "준비물 설치에 실패했습니다."

echo ""
echo "✅ 업데이트가 끝났습니다."
echo ""
echo "이어서 서버를 켭니다. 이 창은 끄지 마세요 (끄면 서버도 꺼집니다)."
echo ""
exec zsh ./start.command
