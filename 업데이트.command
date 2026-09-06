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

# ── 이 파일이 올바른 폴더에 있는지 먼저 확인한다 ────────────────────
# start.command 옆이 아니라 Downloads 바로 아래 같은 곳에 두면, 그 자리를
# 프로젝트 폴더로 착각해 엉뚱한 곳에 코드를 풀어놓고 키도 없이 돌아간다.
# 실제로 "파일을 어디에 넣어야 하는지"에서 막히는 일이 반복돼서 여기서 잡는다.
if [ ! -f ./start.command ] || [ ! -f ./package.json ]; then
  echo ""
  echo "▸ 여기는 진단 프로그램 폴더가 아니네요. 올바른 폴더를 찾아봅니다..."
  echo "  (지금 위치: $(pwd))"

  CANDIDATES=()
  for base in "$HOME/Downloads" "$HOME/Desktop" "$HOME/Documents" "$HOME"; do
    [ -d "$base" ] || continue
    while IFS= read -r hit; do
      dir="${hit:h}"
      [ -f "$dir/package.json" ] || continue
      # 같은 폴더가 여러 번 잡히지 않게 거른다.
      [[ " ${CANDIDATES[*]} " == *" $dir "* ]] || CANDIDATES+=("$dir")
    done < <(find "$base" -maxdepth 4 -name start.command -not -path '*/node_modules/*' 2>/dev/null)
  done

  if [ ${#CANDIDATES[@]} -eq 0 ]; then
    echo ""
    echo "❌ 진단 프로그램 폴더를 찾지 못했습니다."
    echo ""
    echo "   이 파일은 'start.command' 가 같이 보이는 폴더에 넣어야 합니다."
    echo "   압축을 아직 안 푸셨다면 zip 파일을 먼저 풀어주세요."
    echo ""
    read -r "?엔터를 누르면 창이 닫힙니다..."
    exit 1
  fi

  if [ ${#CANDIDATES[@]} -gt 1 ]; then
    echo ""
    echo "❌ 후보 폴더가 여러 개입니다. 어느 것인지 제가 고를 수 없습니다."
    echo ""
    for d in $CANDIDATES; do echo "   · $d"; done
    echo ""
    echo "   이 파일을 위 폴더 중 실제로 쓰시는 곳으로 옮긴 뒤 다시 더블클릭해주세요."
    echo ""
    read -r "?엔터를 누르면 창이 닫힙니다..."
    exit 1
  fi

  TARGET="${CANDIDATES[1]}"
  echo "  → 찾았습니다: $TARGET"
  echo "  → 이 파일을 그 폴더로 옮기고 계속합니다."
  cp -f "$0" "$TARGET/$SELF" 2>/dev/null
  chmod +x "$TARGET/$SELF" 2>/dev/null
  cd "$TARGET" || { echo "❌ 폴더로 이동하지 못했습니다."; read -r "?엔터..."; exit 1; }
fi
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
# 반드시 "죽었는지 확인"까지 해야 한다. 예전 서버가 남은 채로 코드만 바뀌면
# 그 서버는 사라진 파일을 계속 붙들고 있어서 모든 페이지가 404가 된다.
# 실제로 겪은 증상이다.
free_port_3000() {
  command -v lsof >/dev/null 2>&1 || return 0
  local tries=0 pids
  while true; do
    pids=$(lsof -ti tcp:3000 2>/dev/null)
    [ -z "$pids" ] && return 0
    tries=$((tries + 1))
    [ "$tries" -gt 12 ] && return 1
    # 처음 세 번은 정상 종료를 요청하고, 그래도 안 죽으면 강제 종료한다.
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
  echo "▸ 켜져 있는 서버를 끕니다..."
  free_port_3000 || fail "돌아가는 서버를 끄지 못했습니다. 맥을 다시 시작한 뒤 이 파일을 다시 실행해주세요."
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
# start.command는 포트가 사용 중이면 "이미 켜져 있다"고 보고 그냥 넘어간다.
# 그 사이 예전 서버가 되살아났다면 여기서 다시 정리해야 새 코드로 켜진다.
free_port_3000 || fail "돌아가는 서버를 끄지 못했습니다. 맥을 다시 시작한 뒤 이 파일을 다시 실행해주세요."
exec zsh ./start.command
