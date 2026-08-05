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
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
    });

    try {
      const page = await browser.newPage();
      // HTML은 외부 리소스 없이 자체 완결이므로 load면 충분하다.
      await page.setContent(html, { waitUntil: "load" });
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
    return NextResponse.json(
      { error: `PDF 생성에 실패했습니다: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
