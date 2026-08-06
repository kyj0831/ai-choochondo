import { NextRequest, NextResponse } from "next/server";
import { getLatestReport, getProject, getReport, listEvidence, listQueries } from "@/lib/repo";
import { buildReportHtml } from "@/lib/reportHtml";
import { ReportJSON } from "@/lib/types";

// puppeteer는 Node 런타임이 필요하다(Edge 불가).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// PDF 렌더링은 수 초 걸릴 수 있다.
export const maxDuration = 60;

/**
 * 리포트를 PDF 또는 HTML로 내보낸다.
 *   /export?format=pdf           최신 회차 PDF
 *   /export?format=html          렌더링 확인용 HTML
 *   /export?format=pdf&run=<id>  특정 회차
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const project = getProject(params.id);
  if (!project) return NextResponse.json({ error: "프로젝트를 찾을 수 없습니다." }, { status: 404 });

  const runId = req.nextUrl.searchParams.get("run");
  const report = runId ? getReport(runId) : getLatestReport(params.id);
  if (!report || report.project_id !== params.id) {
    return NextResponse.json({ error: "리포트가 아직 없습니다. 분석을 먼저 실행하세요." }, { status: 404 });
  }

  let data: ReportJSON;
  try {
    data = JSON.parse(report.report_json) as ReportJSON;
  } catch {
    return NextResponse.json({ error: "리포트 데이터를 읽을 수 없습니다." }, { status: 500 });
  }

  const html = buildReportHtml({
    project,
    report,
    data,
    queries: listQueries(params.id),
    evidence: listEvidence(params.id),
  });

  const format = req.nextUrl.searchParams.get("format") ?? "pdf";
  if (format === "html") {
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  try {
    // 요청 시점에만 로드한다. 최상단 import로 두면 puppeteer가 없는 환경에서
    // 이 라우트와 무관한 빌드까지 실패한다.
    const puppeteer = (await import("puppeteer")).default;
    const executablePath = await resolveChromium();
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      // 한글 웹폰트가 적용되기 전에 인쇄하면 글자가 두부(□)로 나온다.
      // 폰트 로딩을 기다리되, 네트워크가 막힌 환경에서 무한정 대기하지 않도록 상한을 둔다.
      await Promise.race([
        page.evaluate(() => document.fonts.ready.then(() => undefined)),
        new Promise((resolve) => setTimeout(resolve, 5000)),
      ]);
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: "<div></div>",
        footerTemplate: `<div style="width:100%;font-size:7pt;color:#94a3b8;padding:0 14mm;display:flex;justify-content:space-between">
          <span>${escapeHtml(project.brand_name)} · AI 추천도 리포트</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
      });

      const dateTag = report.created_at.slice(0, 10);
      const fileName = `${project.brand_name}_AI추천도_${report.run_number}차_${dateTag}.pdf`;

      return new NextResponse(Buffer.from(pdf), {
        headers: {
          "Content-Type": "application/pdf",
          // 한글 파일명은 filename*(RFC 5987)로 전달해야 깨지지 않는다.
          "Content-Disposition": `attachment; filename="report.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        },
      });
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.error("[export] PDF 생성 실패:", e);
    const msg = (e as Error).message ?? "";
    // Chromium이 없거나 실행되지 않는 환경(배포 설정 누락 등)에서는
    // 원인과 대안을 명확히 알려준다. 리포트 자체는 ?format=html로 볼 수 있다.
    const chromiumMissing =
      /ENOENT|Could not find|Failed to launch|shared librar|browser was not found/i.test(msg);
    return NextResponse.json(
      {
        error: chromiumMissing
          ? "이 서버에서 PDF 변환기(Chromium)를 실행할 수 없습니다. 같은 주소에 ?format=html 을 붙이면 리포트를 웹페이지로 보고 브라우저 인쇄 기능으로 PDF로 저장할 수 있습니다."
          : `PDF 생성에 실패했습니다: ${msg}`,
        htmlFallback: `/api/projects/${params.id}/export?format=html${runId ? `&run=${runId}` : ""}`,
      },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * 실행할 Chromium을 찾는다.
 *
 * 배포 이미지에는 apt로 설치한 시스템 chromium을 쓰는데, 배포판에 따라
 * 실행 파일 경로가 달라(chromium / chromium-browser 등) 한 곳으로 고정하면
 * 환경이 바뀔 때마다 깨진다. 후보를 순서대로 확인하고, 아무것도 없으면
 * undefined를 돌려줘 puppeteer 기본 동작(번들 브라우저)에 맡긴다.
 */
async function resolveChromium(): Promise<string | undefined> {
  const { access } = await import("fs/promises");

  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
  ].filter((p): p is string => !!p);

  for (const path of candidates) {
    try {
      await access(path);
      return path;
    } catch {
      // 다음 후보로 넘어간다.
    }
  }
  return undefined;
}
