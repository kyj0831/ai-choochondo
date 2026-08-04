import { NextRequest, NextResponse } from "next/server";
import { listPublishedHubs } from "@/lib/repo";

export const dynamic = "force-dynamic";

/** 발행된 허브만 색인 대상으로 노출한다. */
export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = `${proto}://${host}`;

  const entries = listPublishedHubs()
    .map(
      (h) => `  <url>
    <loc>${base}/p/${encodeURIComponent(h.slug)}</loc>
    <lastmod>${new Date(h.updated_at + "Z").toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
