import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getHubBySlug, getProject, incrementHubView, recordCrawl } from "@/lib/repo";
import { buildJsonLd, platformLabel, stripDraftMark } from "@/lib/hub";
import { identifyBot } from "@/lib/crawlers";
import { Hub } from "@/lib/types";

// 항상 최신 내용을 서빙한다. 허브는 수정 즉시 AI가 읽어가야 의미가 있다.
export const dynamic = "force-dynamic";

function baseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const hub = getHubBySlug(params.slug);
  if (!hub || !hub.published) return { title: "찾을 수 없는 프로필" };

  const desc = stripDraftMark(hub.one_liner) || stripDraftMark(hub.bio) || `${hub.display_name} 공식 프로필`;
  const url = `${baseUrl()}/p/${hub.slug}`;

  return {
    title: `${hub.display_name} — 공식 프로필`,
    description: desc,
    keywords: hub.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title: `${hub.display_name} — 공식 프로필`,
      description: desc,
      url,
      locale: "ko_KR",
    },
    twitter: { card: "summary", title: hub.display_name, description: desc },
    robots: { index: true, follow: true },
  };
}

const ACCENTS: Record<string, { bg: string; text: string; ring: string; soft: string }> = {
  indigo: { bg: "bg-indigo-600", text: "text-indigo-600", ring: "ring-indigo-100", soft: "bg-indigo-50" },
  emerald: { bg: "bg-emerald-600", text: "text-emerald-600", ring: "ring-emerald-100", soft: "bg-emerald-50" },
  rose: { bg: "bg-rose-600", text: "text-rose-600", ring: "ring-rose-100", soft: "bg-rose-50" },
  amber: { bg: "bg-amber-500", text: "text-amber-600", ring: "ring-amber-100", soft: "bg-amber-50" },
  slate: { bg: "bg-slate-800", text: "text-slate-700", ring: "ring-slate-100", soft: "bg-slate-50" },
};

export default function HubPage({ params }: { params: { slug: string } }) {
  const hub = getHubBySlug(params.slug);
  if (!hub || !hub.published) notFound();

  const project = getProject(hub.project_id);
  const url = `${baseUrl()}/p/${hub.slug}`;

  // 접근 기록: AI 크롤러면 어떤 사업자의 봇인지 남기고, 사람이면 조회수만 올린다.
  const ua = headers().get("user-agent");
  const bot = identifyBot(ua);
  if (bot) {
    recordCrawl({
      hub_id: hub.id,
      bot_key: bot.key,
      bot_label: bot.label,
      operator: bot.operator,
      path: `/p/${hub.slug}`,
      user_agent: ua || "",
    });
  } else {
    incrementHubView(hub.id);
  }

  const disambiguation =
    project?.same_name_conflict && project.same_name_note ? project.same_name_note : null;
  const jsonLd = buildJsonLd(hub, project?.entity_type ?? "기업/제품", url, disambiguation);
  const accent = ACCENTS[hub.accent] ?? ACCENTS.indigo;

  const faq = hub.faq.filter((f) => f.q.trim() && f.a.trim());
  const services = hub.services.filter((s) => s.title.trim() && s.description.trim());
  const oneLiner = stripDraftMark(hub.one_liner);
  const bio = stripDraftMark(hub.bio);

  return (
    <>
      {/* AI가 엔터티·공식 채널·FAQ를 기계적으로 읽을 수 있게 하는 구조화 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* 채널 소유권 선언(IndieAuth rel=me). sameAs와 함께 동일 주체임을 알린다. */}
      {hub.links.map((l) => (
        <link key={l.url} rel="me" href={l.url} />
      ))}
      <link rel="alternate" type="text/plain" href={`${url}/llms.txt`} title="llms.txt" />

      <div className="min-h-screen bg-slate-50">
        <article className="mx-auto max-w-2xl px-5 py-14">
          {/* 정체성 */}
          <header className="text-center mb-10">
            <div
              className={`w-20 h-20 rounded-2xl ${accent.bg} text-white text-3xl font-bold grid place-items-center mx-auto mb-5 ring-8 ${accent.ring}`}
              aria-hidden="true"
            >
              {hub.display_name.slice(0, 1)}
            </div>
            <h1 className="text-3xl font-bold text-slate-900">{hub.display_name}</h1>
            {hub.headline && <p className={`mt-2 text-sm font-medium ${accent.text}`}>{hub.headline}</p>}
            {oneLiner && (
              <p className="mt-5 text-lg leading-relaxed text-slate-700">{oneLiner}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
              {hub.region && <span className="rounded-full bg-white px-3 py-1 ring-1 ring-slate-200">{hub.region}</span>}
              {hub.keywords.map((k) => (
                <span key={k} className={`rounded-full ${accent.soft} ${accent.text} px-3 py-1 font-medium`}>
                  {k}
                </span>
              ))}
            </div>
          </header>

          {/* 동명이인 분리 — AI가 다른 주체와 섞지 않도록 사람에게도 명시한다 */}
          {disambiguation && (
            <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">
                동명 주체와의 구분
              </h2>
              <p className="text-sm text-amber-900 leading-relaxed">{disambiguation}</p>
            </section>
          )}

          {/* 공식 채널 */}
          {hub.links.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">공식 채널</h2>
              <ul className="space-y-2">
                {hub.links.map((l) => (
                  <li key={l.url}>
                    <a
                      href={l.url}
                      rel="me noopener"
                      target="_blank"
                      className="flex items-center justify-between rounded-xl bg-white px-4 py-3.5 ring-1 ring-slate-200 transition hover:ring-slate-300 hover:shadow-sm"
                    >
                      <span className="font-medium text-slate-800 text-sm">
                        {l.label || platformLabel(l.platform)}
                      </span>
                      <span className="text-slate-400 text-xs truncate max-w-[55%] text-right">
                        {l.url.replace(/^https?:\/\//, "")}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 소개 */}
          {bio && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">소개</h2>
              <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
                <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{bio}</p>
              </div>
            </section>
          )}

          {/* 제공 서비스 */}
          {services.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">제공 서비스</h2>
              <ul className="space-y-2">
                {services.map((s) => (
                  <li key={s.title} className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
                    <h3 className="font-semibold text-sm text-slate-900 mb-1">{s.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{s.description}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* FAQ — 진단에서 실제로 노출되지 않은 질의를 겨냥해 작성된 부분 */}
          {faq.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">자주 묻는 질문</h2>
              <div className="space-y-2">
                {faq.map((f) => (
                  <div key={f.q} className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
                    <h3 className="font-semibold text-sm text-slate-900 mb-1.5">{f.q}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{f.a}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 대상 청중 */}
          {hub.audiences.length > 0 && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">주요 대상</h2>
              <div className="flex flex-wrap gap-2">
                {hub.audiences.map((a) => (
                  <span key={a} className="rounded-lg bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200">
                    {a}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* 문의 */}
          {(hub.contact_email || hub.contact_note) && (
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">문의</h2>
              <div className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
                {hub.contact_email && (
                  <a href={`mailto:${hub.contact_email}`} className={`text-sm font-medium ${accent.text}`}>
                    {hub.contact_email}
                  </a>
                )}
                {hub.contact_note && <p className="mt-1 text-sm text-slate-600">{hub.contact_note}</p>}
              </div>
            </section>
          )}

          <footer className="mt-12 border-t border-slate-200 pt-6 text-center">
            <p className="text-xs text-slate-400">
              이 페이지는 {hub.display_name} 본인이 확인한 공식 정보입니다. 최종 갱신{" "}
              <time dateTime={hub.updated_at}>{new Date(hub.updated_at + "Z").toLocaleDateString("ko-KR")}</time>
            </p>
            <p className="mt-2 text-xs text-slate-300">
              <a href={`${url}/llms.txt`} className="underline hover:text-slate-400">
                llms.txt
              </a>
              {" · "}
              AI 추천도 진단으로 생성
            </p>
          </footer>
        </article>
      </div>
    </>
  );
}
