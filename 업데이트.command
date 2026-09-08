#!/bin/zsh
# AI 추천도 — 최신 코드 받아오기 (macOS 더블클릭 실행용)
#
# 고쳐진 내용이 GitHub에는 올라가 있는데 내 맥북 폴더에는 아직 없는 상태가 자주 생긴다.
# 그러면 이미 고친 문제가 화면에서 계속 그대로 보인다 — 실제로 그렇게 헤맨 적이 있다.
# 이 스크립트는 그 간극을 없앤다.
cd "$(dirname "$0")"

BRANCH="claude/ai-discoverability-prd"

echo ""
echo "  AI 추천도 — 최신 코드 받아오기"
echo "  ────────────────────────────────"
echo ""

# 서버가 켜진 채로 아래에서 .next 를 지우면 돌아가던 서버가 망가져
# 모든 페이지가 404 가 된다. 그 상태에서 start.command 를 누르면
# "이미 켜져 있다"며 새 서버를 띄우지 않고 망가진 서버로 브라우저만 연다.
# 실제로 그렇게 됐다. 그래서 먼저 끈다 — 이 스크립트 계열이 띄운 개발 서버다.
if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:3000 >/dev/null 2>&1; then
  echo "  ℹ️  돌아가던 서버를 먼저 끕니다. (켜진 채로 업데이트하면 화면이 전부 404가 됩니다)"
  lsof -ti tcp:3000 | xargs kill 2>/dev/null
  for _ in 1 2 3 4 5; do
    lsof -ti tcp:3000 >/dev/null 2>&1 || break
    sleep 1
  done
  if lsof -ti tcp:3000 >/dev/null 2>&1; then
    echo ""
    echo "  ❌ 서버가 꺼지지 않았습니다. 서버 터미널 창에서 Control + C 를 누른 뒤 다시 실행하세요."
    echo ""
    read -r "?엔터를 누르면 창이 닫힙니다..."
    exit 1
  fi
  echo "     껐습니다."
  echo ""
fi

if ! command -v git >/dev/null 2>&1; then
  echo "  ❌ git이 설치되어 있지 않습니다."
  echo "     터미널에서  xcode-select --install  을 실행해 설치한 뒤 다시 시도하세요."
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

# ZIP으로 내려받은 폴더는 git 저장소가 아니라서 업데이트를 받을 수 없다.
if [ ! -d .git ]; then
  echo "  ❌ 이 폴더는 GitHub과 연결되어 있지 않습니다."
  echo "     (압축 파일로 내려받으면 이렇게 됩니다.)"
  echo ""
  echo "     해결: 터미널에서 아래를 실행해 새로 받으세요."
  echo "     git clone https://github.com/kyj0831/ai-choochondo.git"
  echo ""
  echo "     ※ 지금 폴더의 data 폴더(진단 기록)를 새 폴더로 옮기면 그대로 이어집니다."
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

# 내가 고친 게 있으면 지우지 않고 따로 보관한다. 말없이 날리는 것이 제일 나쁘다.
#
# git diff만 보면 '새로 만든 파일'을 놓친다. 그 파일이 새 버전에도 있으면
# checkout이 덮어쓰기를 거부해 업데이트 자체가 실패한다 — 실제로 그렇게 실패했다.
# status --porcelain은 새 파일까지 본다.
# (data/의 진단 기록은 .gitignore 대상이라 여기 걸리지 않는다. 건드리지 않는다.)
STASHED=0
if [ -n "$(git status --porcelain)" ]; then
  echo "  ℹ️  이 폴더에서 직접 고친 내용이 있어 따로 보관합니다."
  git stash push -u -m "업데이트 전 자동 보관 $(date '+%Y-%m-%d %H:%M')" >/dev/null 2>&1 && STASHED=1
  echo "     (되돌리려면 터미널에서  git stash pop  )"
  echo ""
fi

echo "  📥 최신 코드를 받는 중..."

# 네트워크가 불안정할 때를 대비해 몇 번 다시 시도한다.
FETCHED=0
for delay in 0 2 4 8; do
  [ "$delay" -gt 0 ] && sleep "$delay"
  if git fetch origin "$BRANCH" >/dev/null 2>&1; then
    FETCHED=1
    break
  fi
  [ "$delay" -eq 0 ] && echo "     연결이 불안정합니다. 다시 시도합니다..."
done

if [ "$FETCHED" -eq 0 ]; then
  echo ""
  echo "  ❌ GitHub에 연결하지 못했습니다. 인터넷 연결을 확인하고 다시 실행해 주세요."
  echo ""
  [ "$STASHED" -eq 1 ] && git stash pop >/dev/null 2>&1
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

BEFORE=$(git rev-parse HEAD 2>/dev/null)

if ! git checkout -B "$BRANCH" FETCH_HEAD >/dev/null 2>&1; then
  echo ""
  echo "  ❌ 코드를 바꾸지 못했습니다."
  echo "     터미널에서  git status  를 실행한 화면을 그대로 전달해 주세요."
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 1
fi

AFTER=$(git rev-parse HEAD 2>/dev/null)

echo ""
if [ "$BEFORE" = "$AFTER" ]; then
  echo "  ✅ 이미 최신 상태입니다. 바뀐 것이 없습니다."
  echo ""
  read -r "?엔터를 누르면 창이 닫힙니다..."
  exit 0
fi

echo "  ✅ 최신 코드를 받았습니다."
echo ""
echo "  바뀐 내용:"
git log --oneline --no-decorate "$BEFORE..$AFTER" 2>/dev/null | head -10 | sed 's/^/     · /'
echo ""

# 코드가 바뀌면 설치된 라이브러리도 맞춰야 한다.
if [ -n "$(git diff --name-only "$BEFORE" "$AFTER" -- package.json package-lock.json 2>/dev/null)" ]; then
  echo "  📦 필요한 라이브러리를 새로 설치합니다 (조금 걸립니다)..."
  npm install
  echo ""
fi

# 이전 빌드가 남아 있으면 바뀐 화면이 안 나오는 경우가 있다.
rm -rf .next

echo "  ────────────────────────────────"
echo "  이제 'start.command'를 다시 실행하세요."
echo ""
echo "  ※ 서버가 켜져 있었다면, 그 터미널 창에서 Control + C 로 먼저 끄고"
echo "    start.command 를 다시 더블클릭하세요. 그래야 바뀐 화면이 나옵니다."
echo ""
read -r "?엔터를 누르면 이 창이 닫힙니다..."
