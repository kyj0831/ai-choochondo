#!/bin/zsh
# AI 추천도 진단 — 깨끗한 새 폴더에 설치 (더블클릭 실행용, macOS)
#
# 폴더 상태가 망가져 업데이트로도 살아나지 않을 때 쓴다.
# 기존 폴더는 절대 건드리지 않고, 바탕화면에 새 폴더를 만들어 처음부터 설치한다.
# API 키(.env.local)와 진단 데이터(data/)만 기존 폴더에서 가져온다.

# 한글 파일명을 다루려면 UTF-8 로케일이 필요하다. Finder에서 더블클릭하면
# 로케일이 비어 있을 수 있고, 그 상태로 압축을 풀면 파일 이름이 깨진다.
for L in en_US.UTF-8 ko_KR.UTF-8 C.UTF-8 C.utf8; do
  if locale -a 2>/dev/null | grep -qix "$L"; then
    export LC_ALL="$L" LANG="$L"
    break
  fi
done

REPO_ZIP="https://codeload.github.com/kyj0831/ai-choochondo/zip/refs/heads/main"

fail() {
  echo ""
  echo "❌ $1"
  [ -n "$TMP" ] && rm -rf "$TMP"
  echo ""
  echo "   기존 폴더는 그대로 있습니다. 아무것도 잃지 않았습니다."
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
}

echo ""
echo "═══════════════════════════════════════════════"
echo "  AI 추천도 진단 — 새로 설치"
echo "═══════════════════════════════════════════════"
echo ""
echo "기존 폴더는 건드리지 않습니다. 바탕화면에 새 폴더를 만들어 설치하고,"
echo "API 키와 지금까지의 진단 결과만 가져옵니다."

# ── 1. 돌아가는 서버 끄기 ───────────────────────────────────────
if command -v lsof >/dev/null 2>&1 && [ -n "$(lsof -ti tcp:3000 2>/dev/null)" ]; then
  echo ""
  echo "▸ 켜져 있는 서버를 끕니다..."
  tries=0
  while [ -n "$(lsof -ti tcp:3000 2>/dev/null)" ]; do
    tries=$((tries + 1))
    [ "$tries" -gt 12 ] && fail "돌아가는 서버를 끄지 못했습니다. 맥을 다시 시작한 뒤 실행해주세요."
    if [ "$tries" -le 3 ]; then
      lsof -ti tcp:3000 2>/dev/null | xargs kill 2>/dev/null
    else
      lsof -ti tcp:3000 2>/dev/null | xargs kill -9 2>/dev/null
    fi
    sleep 1
  done
fi

# ── 2. 기존 폴더 찾기 (키·데이터를 가져오기 위함) ────────────────
echo ""
echo "▸ 기존 폴더를 찾는 중..."
OLD=""
BEST=-1
# macOS는 홈 폴더를 훑으면 사진 보관함·iCloud 접근 권한을 물어본다. 우리는 그런
# 파일을 읽을 일이 없으므로 검색 범위를 내려받기·바탕화면·문서로만 좁히고,
# 보관함 경로는 아예 들어가지 않는다. (그래도 물어보면 "허용 안 함"으로 충분하다)
for base in "$HOME/Downloads" "$HOME/Desktop" "$HOME/Documents"; do
  [ -d "$base" ] || continue
  while IFS= read -r hit; do
    dir="${hit:h}"
    [ -f "$dir/package.json" ] || continue
    # 키와 진단 데이터가 있는 폴더를 우선한다. 둘 다 있으면 2점, 하나면 1점.
    score=0
    [ -f "$dir/.env.local" ] && score=$((score + 1))
    [ -f "$dir/data/app.sqlite" ] && score=$((score + 1))
    if [ "$score" -gt "$BEST" ]; then
      BEST=$score
      OLD="$dir"
    fi
  done < <(find "$base" -maxdepth 4 -name start.command \
      -not -path '*/node_modules/*' \
      -not -path '*/Library/*' \
      -not -path '*/Pictures/*' \
      -not -path '*.photoslibrary/*' 2>/dev/null)
done

if [ -n "$OLD" ]; then
  echo "  → 찾았습니다: $OLD"
  [ -f "$OLD/.env.local" ] && echo "     · API 키 있음 (가져옵니다)" || echo "     · API 키 없음 (나중에 키넣기.command로 넣으세요)"
  [ -f "$OLD/data/app.sqlite" ] && echo "     · 진단 데이터 있음 (가져옵니다)" || echo "     · 진단 데이터 없음"
else
  echo "  → 기존 폴더를 못 찾았습니다. 완전히 새로 설치합니다."
fi

# ── 3. 새 폴더 만들기 ───────────────────────────────────────────
DEST="$HOME/Desktop/ai-choochondo"
n=2
while [ -e "$DEST" ]; do
  DEST="$HOME/Desktop/ai-choochondo-$n"
  n=$((n + 1))
done

echo ""
echo "▸ 최신 코드를 내려받는 중..."
TMP=$(mktemp -d) || fail "임시 폴더를 만들지 못했습니다."
curl -fsSL -m 180 -o "$TMP/latest.zip" "$REPO_ZIP" \
  || fail "내려받기에 실패했습니다. 인터넷 연결을 확인하고 다시 실행해주세요."

if command -v ditto >/dev/null 2>&1; then
  ditto -x -k "$TMP/latest.zip" "$TMP" || fail "압축을 푸는 데 실패했습니다."
else
  LC_ALL=en_US.UTF-8 unzip -qo "$TMP/latest.zip" -d "$TMP" || fail "압축을 푸는 데 실패했습니다."
fi

# 이름이 깨졌다면(#Uxxxx 형태) 원래 한글 이름으로 되돌린다.
for f in "$TMP/ai-choochondo-main"/*(N); do
  base="${f:t}"
  [[ "$base" == *'#U'* ]] || continue
  decoded=$(printf '%b' "${base//\#U/\\u}")
  [ -n "$decoded" ] && [ "$decoded" != "$base" ] && mv -f "$f" "${f:h}/$decoded"
done

[ -f "$TMP/ai-choochondo-main/package.json" ] || fail "내려받은 내용이 예상과 다릅니다."

mv "$TMP/ai-choochondo-main" "$DEST" || fail "새 폴더를 만들지 못했습니다: $DEST"
rm -rf "$TMP"
TMP=""
chmod +x "$DEST"/*.command 2>/dev/null

echo "  → 새 폴더: $DEST"

# ── 4. 키와 진단 데이터 가져오기 ────────────────────────────────
if [ -n "$OLD" ]; then
  echo ""
  echo "▸ API 키와 진단 데이터를 옮깁니다..."
  [ -f "$OLD/.env.local" ] && cp "$OLD/.env.local" "$DEST/.env.local"
  if [ -d "$OLD/data" ]; then
    mkdir -p "$DEST/data"
    cp -R "$OLD/data/." "$DEST/data/" 2>/dev/null
  fi
fi

# ── 5. 설치하고 켜기 ────────────────────────────────────────────
cd "$DEST" || fail "새 폴더로 이동하지 못했습니다."
echo ""
echo "▸ 준비물을 설치합니다. 3~5분 걸립니다. 이 창을 끄지 마세요..."
npm install || fail "준비물 설치에 실패했습니다. 인터넷 연결을 확인하고 다시 실행해주세요."

echo ""
echo "✅ 새로 설치가 끝났습니다."
echo ""
echo "   위치: $DEST  (바탕화면)"
echo "   앞으로는 이 폴더의 파일들을 쓰시면 됩니다."
if [ -n "$OLD" ] && [ "$OLD" != "$DEST" ]; then
  echo "   예전 폴더($OLD)는 잘 되는 걸 확인한 뒤 지우셔도 됩니다."
fi
echo ""
exec zsh ./start.command
