# 배포 가이드 — 웹사이트로 올리기

이 앱을 인터넷에 올려 **URL로 접속하는 웹사이트**로 만드는 방법입니다.
배포하면 `https://...` 주소가 생기고, 그 주소를 아는 사람은 브라우저에서 바로 씁니다.

이 앱은 **Node 서버 + SQLite 파일 + PDF 렌더링(Chromium)** 구조라,
Vercel·Netlify 같은 서버리스보다 **"컨테이너 + 영구 볼륨"**을 주는 호스트가 맞습니다.
아래 세 방법 중 하나를 고르세요.

| 방법 | 언제 | 난이도 |
|---|---|---|
| **A. Railway + GitHub** | 코드가 이미 GitHub에 있음. 푸시하면 자동 재배포 | ★ 가장 쉬움 |
| **B. Railway CLI** | GitHub 없이 로컬에서 바로 올릴 때 | ★★ |
| **C. Docker (Render / Fly.io 등)** | 다른 호스트를 쓰거나 이미지로 배포할 때 | ★★ |

> 비용: 소규모 기준 월 $5 안팎 + AI API 사용량 별도. 신규 계정은 대개 무료 크레딧이 있습니다.
> 빌드는 검증됨: `npm ci && npm run build`가 깨끗하게 통과합니다(Node 22 기준).

---

## 공통 — 반드시 설정할 환경변수

어느 방법이든 아래 값을 호스트의 **Variables(환경변수)**에 넣습니다. 코드에는 넣지 마세요.

| 변수 | 필수 | 설명 |
|---|---|---|
| `OPENAI_API_KEY` **또는** `ANTHROPIC_API_KEY` | 사실상 필수 | 둘 중 **하나만**. 없으면 "데모 모드"(샘플)로만 동작 |
| `DATA_DIR` | 필수 | SQLite 저장 경로. 볼륨 마운트 경로와 동일하게 `/data` |
| `APP_PASSWORD` | **강력 권장** | 접근 비밀번호. 없으면 URL 아는 누구나 모든 진단 데이터 열람 |
| `AUTH_SECRET` | 권장 | 세션 서명용 랜덤 문자열. `openssl rand -hex 16`로 생성 |

> AI 프로필 허브(`/p/*`), `robots.txt`, `sitemap.xml`, `llms.txt`는 비밀번호와 무관하게
> **항상 공개**입니다. AI 크롤러가 읽어가는 것이 그 페이지의 목적이기 때문입니다.

---

## A. Railway + GitHub (권장)

이 저장소는 이미 GitHub(`kyj0831/ai-choochondo`)에 있고, `nixpacks.toml`/`railway.json`로
빌드 설정이 들어 있어 별도 설정 없이 바로 배포됩니다.

1. https://railway.app 가입(GitHub 계정으로).
2. **New Project → Deploy from GitHub repo → `kyj0831/ai-choochondo`** 선택.
   - 배포 브랜치는 `main`.
3. 서비스 → **Variables** 탭에서 위 [공통 환경변수](#공통--반드시-설정할-환경변수)를 입력.
4. 서비스 → **Settings → Volumes → New Volume**, Mount path `/data`
   (환경변수 `DATA_DIR`과 동일하게). 볼륨을 붙이면 자동 재배포됩니다.
5. **Settings → Networking → Generate Domain**으로 공개 URL 생성
   (예: `ai-choochondo.up.railway.app`). 이 URL을 공유하면 끝.

이후에는 `main`에 커밋을 푸시할 때마다 자동으로 다시 배포됩니다.

---

## B. Railway CLI (GitHub 없이)

```bash
npm install -g @railway/cli
railway login            # 브라우저 로그인

# 이 프로젝트 폴더에서
railway init             # 프로젝트 이름 입력 (예: ai-choochondo)

# 환경변수 (위 표 참고 — 키는 OpenAI/Anthropic 중 하나만)
railway variables --set "OPENAI_API_KEY=sk-본인_키"
railway variables --set "DATA_DIR=/data"
railway variables --set "APP_PASSWORD=원하는_비밀번호"
railway variables --set "AUTH_SECRET=$(openssl rand -hex 16)"

railway up               # 빌드 + 배포
railway domain           # 공개 URL 생성/확인
```

그다음 **대시보드 → Settings → Volumes**에서 Mount path `/data` 볼륨을 붙입니다
(A의 4번과 동일). **볼륨을 안 붙이면 재배포 때 데이터가 사라집니다.**

---

## C. Docker (Render / Fly.io / Cloud Run / VPS)

저장소 루트의 [`Dockerfile`](Dockerfile)이 chromium·한글 폰트·better-sqlite3 빌드까지
포함한 이미지를 만듭니다. 도커 이미지를 받는 호스트라면 어디서든 동일하게 배포됩니다.

로컬에서 직접 실행해보려면:

```bash
docker build -t ai-choochondo .
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-본인_키 \
  -e APP_PASSWORD=원하는_비밀번호 \
  -e AUTH_SECRET=$(openssl rand -hex 16) \
  -v ai-choochondo-data:/data \
  ai-choochondo
# http://localhost:3000
```

- **Render**: New → Web Service → 저장소 연결 → Environment=Docker → 위 환경변수 입력 →
  Disks에서 마운트 경로 `/data` 디스크 추가.
- **Fly.io**: `fly launch`(Dockerfile 자동 감지) → `fly volumes create data` →
  `fly.toml`의 `[mounts]`로 `/data` 연결 → `fly secrets set`으로 환경변수 주입.

`-v .../:/data` 볼륨은 여기서도 필수입니다.

---

## ⚠️ 배포 후 꼭 확인

1. **비밀번호 게이트 확인.** 시크릿 창으로 접속해 로그인 화면이 뜨는지 직접 보세요.
   `APP_PASSWORD`를 안 넣으면 게이트가 꺼진 채 배포되어 데이터가 공개됩니다.
   반대로 허브 페이지(`/p/슬러그`)는 로그인 없이 열려야 정상입니다.
2. **데모 모드 배너가 계속 뜨면** `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`가 비어 있는 것.
3. **비용 모니터링.** 호스트 요금 + OpenAI/Anthropic API 사용량이 별도로 과금됩니다.
4. **데이터 백업.** 진단 데이터는 볼륨의 `app.sqlite` 파일 하나. 중요해지면 주기적으로 백업.

---

## 문제 해결

- **데이터가 자꾸 사라짐** → 볼륨을 안 붙였거나 `DATA_DIR`과 마운트 경로가 다름. 둘 다 `/data`로.
- **PDF의 한글이 □로 나옴** → 이미지에 `fonts-noto-cjk`가 없음(Dockerfile·nixpacks.toml엔 포함됨).
- **PDF 생성 실패(chromium)** → `PUPPETEER_EXECUTABLE_PATH`가 실제 chromium 경로(`/usr/bin/chromium`)를
  가리키는지 확인.
- **빌드 실패(better-sqlite3)** → 네이티브 빌드용 `python3/make/g++`가 필요(Dockerfile에 포함).
  Railway는 자동 처리됩니다. 반복되면 배포 로그를 Claude에게 보여주세요.
