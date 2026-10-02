# 운세 라운지 (베타)

사주·토정비결·궁합·타로·오늘의 운세 사이트입니다. 만세력과 토정비결 괘는 브라우저에서 계산하고,
AI 풀이는 이 폴더의 작은 Node 서버가 회사 Claude API 키로 만들어 줍니다.

- `public/index.html` — 사이트 전체 (화면·계산·성경 구절·바람 한 줄)
- `server.js` — 페이지 제공 + AI 풀이 + 테스터 의견 수집
- 결제는 아직 없습니다. 베타 기간에는 AI 풀이를 무료로 엽니다.

## 배포 — Railway (지금 저장소와 같은 방식)

1. Railway 프로젝트에서 **New → GitHub Repo → `kyj0831/ai-choochondo`** 를 골라 서비스를 하나 더 만듭니다.
2. 새 서비스의 **Settings**
   - **Root Directory**: `unse-lounge`
   - **Branch**: 이 폴더가 들어 있는 브랜치 (main에 합친 뒤라면 `main`)
   - **Config file**: 자동으로 못 찾으면 `/unse-lounge/railway.json`
3. **Variables** 에 아래 값을 넣습니다.
4. **Settings → Networking → Generate Domain** 을 누르면 `https://….up.railway.app` 주소가 생깁니다.
   이 주소를 테스터에게 보내면 됩니다. 회사 하위 도메인(예: `unse.nocutnews.co.kr`)은 같은 화면의 Custom Domain에서 연결합니다.
5. 배포 후 `https://주소/healthz` 가 `{"ok":true,"ai":"on"}` 이면 AI 풀이까지 켜진 것입니다.

| 변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 필수 | Claude API 키 (console.anthropic.com). 없으면 AI 버튼이 숨고 기본 풀이만 나옵니다 |
| `FEEDBACK_KEY` | 권장 | 테스터 의견을 볼 때 쓰는 비밀 문자열. `https://주소/api/feedback?key=이값` |
| `CLAUDE_MODEL` | 선택 | 기본 `claude-opus-5-5`. 비용을 줄이려면 `claude-sonnet-5-5` |
| `CLAUDE_EFFORT` | 선택 | 기본 `low` (운세 풀이에 충분). `medium`·`high`로 올리면 더 공들이고 더 비쌉니다 |
| `AI_LIMIT_PER_IP` | 선택 | 한 사람(IP)이 하루에 받을 수 있는 AI 풀이 수. 기본 20 |
| `AI_LIMIT_TOTAL` | 선택 | 사이트 전체 하루 AI 풀이 수. 기본 1000. 비용 안전장치 |
| `DATA_DIR` | 선택 | 의견 파일 저장 위치. 기본 `./data` |

> 의견 파일은 Railway에 **볼륨**을 붙이지 않으면 재배포할 때 지워집니다.
> 볼륨을 `/data`에 붙이고 `DATA_DIR=/data` 로 두세요. 볼륨이 없어도 의견은 Railway **로그**에 `"ev":"feedback"` 줄로 남습니다.

## 내 컴퓨터에서 실행

```bash
cd unse-lounge
npm install
npm run dev                          # AI 없이 시험용 문장으로 확인 (MOCK_AI=1)
ANTHROPIC_API_KEY=sk-ant-... npm start   # 실제 AI 풀이
```

브라우저에서 http://localhost:3000 을 엽니다.

## 비용과 안전장치

- 풀이 1건은 입력 약 1,500토큰·출력 약 2,000토큰입니다.
  1달러 1,400원 기준으로 Opus 5.5는 약 65원, Sonnet 5.5는 약 32원입니다.
- 하루 한도(`AI_LIMIT_PER_IP`, `AI_LIMIT_TOTAL`)를 넘으면 AI 대신 기본 풀이가 나옵니다.
  서버를 다시 시작하면 한도 계산이 초기화됩니다.
- 서버는 운세 풀이 외의 요청에 답하지 않도록 지시문을 고정해 두었고, 요청 길이를 6,000자로 제한합니다.
- Claude가 드물게 요청을 거절하면 `fallbacks: "default"` 설정에 따라 다른 모델이 이어서 답합니다.
- 생년월일·질문은 풀이를 만드는 데만 쓰고 서버에 저장하거나 로그에 남기지 않습니다.
  로그에는 모델·토큰 수·종료 사유만 남습니다.

## 실서비스 전에 할 일

- 천문연 음양력 API: `public/index.html`의 `KASI` 자리에 서버 엔드포인트를 연결합니다.
- 토정비결 144괘 원문: `TOJUNG_TEXTS` 에 데이터를 채웁니다.
- 결제(단건 900원·1년 이용권 9,900원), 회원, '내 풀이함'.
