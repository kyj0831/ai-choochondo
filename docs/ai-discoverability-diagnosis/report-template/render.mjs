/**
 * AI 추천도 진단 리포트 — HTML → A4 PDF 렌더러 (프로토타입)
 *
 *   node render.mjs [data.json] [out.pdf]
 *
 * headless Chromium(Playwright)으로 인쇄한다. Chromium은 CSS 페이지 마진 박스
 * (@page { @bottom-center { ... } })를 지원하지 않으므로, 머리말·쪽번호는
 * headerTemplate / footerTemplate으로 넣는다. 이 파일이 그 경계다 —
 * 종이 밖(머리말·쪽번호)은 여기서, 종이 안은 template.html에서 관리한다.
 */
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = resolve(process.argv[2] ?? `${here}/sample-data.json`);
const outPath = resolve(process.argv[3] ?? `${here}/out/report.pdf`);

const raw = await readFile(dataPath, 'utf8');
const data = JSON.parse(raw);
const template = await readFile(`${here}/template.html`, 'utf8');

// JSON을 <script type="application/json">에 심는다. </script> 조기 종료만 막으면 된다.
const safe = raw.replace(/<\/script/gi, '<\\/script');
const html = template.replace('/*__DATA__*/', () => safe);

// 렌더된 HTML도 남긴다 — 브라우저로 열어 디자인을 확인할 수 있어야 한다.
await mkdir(dirname(outPath), { recursive: true });
const htmlPath = outPath.replace(/\.pdf$/, '.html');
await writeFile(htmlPath, html, 'utf8');

const chrome = ({ text, size }) =>
  `<div style="width:100%;padding:0 16mm;font-family:'Noto Sans CJK KR',sans-serif;
     font-size:${size};color:#838a96;display:flex;justify-content:space-between;">${text}</div>`;

// 컨테이너에 미리 깔린 Chromium을 쓰려면 CHROMIUM_PATH로 실행 파일을 지정한다.
// (playwright 패키지 버전과 사전 설치 브라우저 빌드 번호가 어긋날 때 필요)
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });

await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  displayHeaderFooter: true,
  margin: { top: '14mm', bottom: '14mm', left: '0', right: '0' },
  headerTemplate: chrome({
    size: '7pt',
    text: `<span>${data.meta.targetName} · AI 추천도 진단 리포트</span><span>${data.meta.diagnosedAt}</span>`,
  }),
  footerTemplate: chrome({
    size: '7.5pt',
    text: `<span>${data.meta.engineVersion} · 추정 진단이며 노출을 보장하지 않습니다</span>
           <span class="pageNumber"></span>`,
  }),
});

await browser.close();
console.log(`✓ ${outPath}`);
console.log(`  (미리보기 HTML: ${htmlPath})`);
