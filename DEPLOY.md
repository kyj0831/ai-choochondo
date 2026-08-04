# Railway 배포 가이드

이 앱을 웹에 올려 URL로 접속할 수 있게 만드는 방법입니다.
Railway는 이 앱처럼 "Node 서버 + SQLite 파일" 구조를 그대로 올릴 수 있는 호스트입니다.

> 준비물: Railway 계정(https://railway.app, GitHub/구글로 가입), 그리고 이 폴더에서 터미널.
> 비용: 사용량 기반, 보통 소규모는 월 $5 안팎. 신규 계정은 무료 크레딧이 있습니다.

---

## A. 가장 간단한 방법 — Railway CLI (GitHub 불필요)

### 1. Railway CLI 설치 + 로그인

```bash
npm install -g @railway/cli
railway login          # 브라우저가 열리며 로그인
```

### 2. 이 폴더에서 프로젝트 생성

```bash
cd "/Users/gge/Documents/Claude/Projects/AI 추천도 진단"
railway init           # 프로젝트 이름 입력 (예: ai-choochondo)
```

### 3. 환경변수(비밀 키) 설정

API 키는 코드에 넣지 않고 여기서 넣습니다. **OpenAI든 Anthropic이든 하나만** 넣으면 됩니다.

```bash
railway variables --set "OPENAI_API_KEY=sk-여기에_본인_키"
# 또는
railway variables --set "ANTHROPIC_API_KEY=sk-ant-여기에_본인_키"

# SQLite 파일을 영구 볼륨에 저장하도록 경로 지정 (아래 5단계 볼륨과 짝)
railway variables --set "DATA_DIR=/data"
```

> 키를 아직 안 넣으면 배포는 되지만 "데모 모드"로 동작합니다(실제 AI 분석 없이 샘플).

### 4. 배포

```bash
railway up
```

빌드가 끝나면 배포 URL이 생성됩니다. 없으면 아래로 공개 도메인을 켭니다:

```bash
railway domain          # 공개 URL 생성/확인 (예: ai-choochondo.up.railway.app)
```

### 5. 영구 디스크(볼륨) 연결 — **꼭 해야 데이터가 안 사라집니다**

Railway 대시보드(https://railway.app) → 방금 만든 프로젝트 → 서비스 클릭 →
**Settings → Volumes → New Volume** →
- Mount path: `/data`  (3단계에서 넣은 `DATA_DIR` 값과 동일하게)

볼륨을 붙이면 자동으로 재배포됩니다. 이제 재시작·재배포해도 진단 데이터가 유지됩니다.

---

## B. GitHub 연동 방법 (코드 수정할 때마다 자동 재배포)

나중에 코드를 자주 고칠 계획이면 이 방식이 편합니다.

1. GitHub에 비공개 저장소를 만들고 이 폴더를 올립니다:
   ```bash
   cd "/Users/gge/Documents/Claude/Projects/AI 추천도 진단"
   git init && git add -A && git commit -m "first"
   git branch -M main
   git remote add origin https://github.com/본인계정/저장소이름.git
   git push -u origin main
   ```
   (`.env.local`과 SQLite 파일은 `.gitignore`에 있어 **업로드되지 않습니다** — 안전)
2. Railway 대시보드 → **New Project → Deploy from GitHub repo** → 저장소 선택
3. 위 A의 3·5단계(환경변수, 볼륨)를 대시보드 **Variables / Volumes** 탭에서 동일하게 설정

---

## ⚠️ 배포 후 꼭 확인 / 다음 단계

1. **접근 제한(로그인)이 아직 없습니다.**
   지금 상태로 배포하면 URL을 아는 사람은 누구나 모든 진단 데이터를 볼 수 있습니다.
   유료 서비스로 팔려면 최소한 비밀번호 보호가 필요합니다 — Claude에게 "로그인 붙여줘"라고
   요청하면 간단한 비밀번호 게이트를 추가해드립니다.

2. **비용 모니터링**: Railway 대시보드에서 사용량/요금을 확인하세요. AI 키를 실제로 쓰면
   OpenAI/Anthropic 쪽에서도 사용량만큼 별도 과금됩니다.

3. **데이터 백업**: 진단 데이터는 볼륨의 `app.sqlite` 파일 하나에 들어있습니다.
   중요해지면 주기적으로 내려받아 백업하세요.

---

## 문제 해결

- **배포는 됐는데 데이터가 자꾸 사라짐** → 볼륨(5단계)을 안 붙였거나 `DATA_DIR`과 마운트
  경로가 다릅니다. 둘 다 `/data`로 맞추세요.
- **"데모 모드" 배너가 계속 뜸** → `OPENAI_API_KEY` 또는 `ANTHROPIC_API_KEY` 환경변수가
  비어 있습니다. 대시보드 Variables에서 확인 후 재배포하세요.
- **빌드 실패(better-sqlite3 관련)** → 대부분 자동 해결됩니다. 반복되면 Railway 로그를
  Claude에게 보여주세요.
