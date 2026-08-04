import { NextRequest, NextResponse } from "next/server";
import { getHubBySlug, getProject, recordCrawl } from "@/lib/repo";
import { buildLlmsTxt } from "@/lib/hub";
import { identifyBot } from "@/lib/crawlers";

export const dynamic = "force-dynamic";

/**
 * llms.txt — AI 에이전트용 평문 요약.
 * HTML을 파싱하지 않아도 "이 브랜드가 무엇이고 공식 채널이 어디인가"를 한 번에 읽을 수 있다.
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const hub = getHubBySlug(params.slug);
  if (!hub || !hub.published) {
    return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const project = getProject(hub.project_id);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const url = `${proto}://${host}/p/${hub.slug}`;

  const ua = req.headers.get("user-agent");
  const bot = identifyBot(ua);
  if (bot) {
    recordCrawl({
      hub_id: hub.id,
      bot_key: bot.key,
      bot_label: bot.label,
      operator: bot.operator,
      path: `/p/${hub.slug}/llms.txt`,
      user_agent: ua || "",
    });
  }

  const disambiguation =
    project?.same_name_conflict && project.same_name_note ? project.same_name_note : null;
  const body = buildLlmsTxt(hub, project?.entity_type ?? "기업/제품", url, disambiguation);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
