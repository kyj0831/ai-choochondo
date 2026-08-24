# 결과지(PDF) 템플릿 — 프로토타입

업체·크리에이터에게 **그대로 건네는 A4 PDF 결과지**의 렌더링 프로토타입.
[PRD의 F10](../PRD.md)이 요구하는 것을 실제로 뽑아본 것이고, 디자인·페이지네이션·
근거 라벨 표기가 인쇄에서 견디는지 확인하는 게 목적이다.

```
template.html     결과지 HTML + 인쇄 CSS + 데이터 → DOM 렌더 스크립트
sample-data.json  샘플 진단 데이터 (실제로는 DB에서 이 형태로 직렬화)
render.mjs        headless Chromium으로 A4 PDF 인쇄
out/              결과물 (report.pdf, report.html) — 커밋하지 않는다
```

## 실행

```bash
npm install
npm run render                       # out/report.pdf
node render.mjs data.json out.pdf    # 데이터·출력 경로 지정
```

컨테이너에 Chromium이 이미 깔려 있고 playwright 패키지 버전과 빌드 번호가 어긋나면:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm run render
```

한글이 □로 나오면 CJK 폰트가 없는 것이다 — `apt-get install -y fonts-noto-cjk`.
서비스 배포 시에는 Pretendard를 컨테이너에 동봉하고 CSS 폰트 스택 1순위로 둔다.

## 설계 메모

**왜 HTML→PDF인가.** 사용자가 준 레퍼런스 PDF는 WeasyPrint(Python)로 뽑은 것이었다.
같은 HTML→PDF 방식이되 제품이 Node/Next.js 스택이라 헤드리스 Chromium을 골랐다.
웹 리포트 화면과 PDF가 **같은 템플릿 한 벌**을 쓰기 때문에 둘이 어긋나지 않는다.

**Chromium의 제약 하나.** CSS 페이지 마진 박스(`@page { @bottom-center { content: counter(page) } }`)를
지원하지 않는다. 그래서 머리말·쪽번호는 `page.pdf()`의 `headerTemplate`/`footerTemplate`으로 넣는다.
**종이 밖은 `render.mjs`, 종이 안은 `template.html`** 이 경계를 지킨다.
페이지 마진 박스를 CSS만으로 쓰고 싶으면 WeasyPrint를 별도 서비스로 두는 선택지도 있다 —
트레이드오프는 PRD F10에 정리했다.

**근거 라벨은 인쇄에서도 살아 있어야 한다.** 확인됨(파랑) / 추정(회색) / 미확인(점선)을
색과 테두리 모양으로 동시에 구분한다. 흑백 인쇄와 색각 이상에서도 구분되게 하려는 것이다.

**플레이스홀더는 눈에 띄어야 한다.** 지어내지 않고 비워둔 `[대괄호]` 자리는 노란 배경 +
점선 밑줄로 강조한다. 결과지를 받은 사람이 그냥 붙여넣다가 대괄호째 발행하는 사고를 막는다.

**페이지 나눔.** 표 행·카드·FAQ 항목에 `page-break-inside: avoid`를 걸어 문장이 페이지 경계에서
잘리지 않게 한다. 대신 아래쪽 여백이 남는 페이지가 생기는데, 인쇄물에서는 이쪽이 정상이다.

**화이트라벨.** `:root`의 `--accent` 계열 3개만 바꾸면 색이 전부 따라온다.
로고·발행처 표기는 아직 없다 — PRD 오픈 이슈 O9.

## 아직 안 한 것

- 로고·발행처 브랜딩 슬롯
- 목차 페이지 (섹션이 12개 + 부록 3개라 필요해질 수 있다)
- 웹 리포트 화면과의 템플릿 공유 (지금은 PDF 전용 1벌)
- 축별 점수 시각화 (레이더 차트 등) — 표만으로 충분한지 M0에서 판단
