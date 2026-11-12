import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { v4 as uuid } from "uuid";
import { getBookingConfig } from "@/lib/booking/config";
import { calendarMode, isSlotStillFree } from "@/lib/booking/slots";
import { createEvent } from "@/lib/booking/google";
import { draftEvent } from "@/lib/booking/ai";
import { insertBooking } from "@/lib/booking/store";

export const dynamic = "force-dynamic";

const Body = z.object({
  start: z.string().datetime(),
  duration: z.number().int(),
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(200),
  company: z.string().trim().min(1).max(100),
  jobTitle: z.string().trim().min(1).max(60),
  purpose: z.string().trim().min(1).max(2000),
  mode: z.enum(["online", "offline"]),
  timeZone: z.string().max(64).optional(),
  /** 봇 차단용 숨김 필드 — 사람은 비워 둔다 */
  website: z.string().max(0).optional(),
});

// 같은 슬롯에 동시에 들어온 요청이 둘 다 통과하지 않도록 프로세스 안에서 직렬화한다.
let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "입력값을 확인해 주세요.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const b = parsed.data;
  const cfg = getBookingConfig();
  const start = new Date(b.start);
  const end = new Date(start.getTime() + b.duration * 60000);

  return serialize(async () => {
    try {
      if (!(await isSlotStillFree(start, b.duration))) {
        return NextResponse.json(
          { error: "방금 다른 일정이 잡힌 시간입니다. 다른 시간을 선택해 주세요.", code: "SLOT_TAKEN" },
          { status: 409 }
        );
      }

      const draft = await draftEvent({
        hostCompany: cfg.host.company,
        name: b.name,
        company: b.company,
        jobTitle: b.jobTitle,
        purpose: b.purpose,
        duration: b.duration,
      });

      const description = [
        `예약자: ${b.name} · ${b.company} · ${b.jobTitle}`,
        `이메일: ${b.email}`,
        `방식: ${b.mode === "online" ? "온라인 (Google Meet)" : "오프라인"}`,
        b.timeZone ? `예약자 시간대: ${b.timeZone}` : "",
        "",
        "■ 아젠다" + (draft.by === "ai" ? " (AI 초안)" : ""),
        ...draft.agenda.map((a, i) => `${i + 1}. ${a}`),
        "",
        "■ 예약자가 남긴 미팅 목적",
        b.purpose,
      ]
        .filter((l, i, arr) => !(l === "" && arr[i - 1] === ""))
        .join("\n");

      const id = uuid();
      let googleEventId: string | null = null;
      let meetLink: string | null = null;
      let htmlLink: string | undefined;

      if (calendarMode() === "google") {
        const ev = await createEvent({
          start,
          end,
          summary: draft.title,
          description,
          attendee: { email: b.email, name: b.name },
          online: b.mode === "online",
          location: b.mode === "offline" ? cfg.offlineLocation : undefined,
          requestId: id,
        });
        googleEventId = ev.id;
        meetLink = ev.meetLink || null;
        htmlLink = ev.htmlLink;
      }

      insertBooking({
        id,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        name: b.name,
        email: b.email,
        company: b.company,
        job_title: b.jobTitle,
        purpose: b.purpose,
        mode: b.mode,
        event_title: draft.title,
        google_event_id: googleEventId,
        meet_link: meetLink,
      });

      return NextResponse.json({
        id,
        start: start.toISOString(),
        end: end.toISOString(),
        title: draft.title,
        agenda: draft.agenda,
        agendaBy: draft.by,
        meetLink,
        htmlLink,
        mode: calendarMode(),
        location: b.mode === "offline" ? cfg.offlineLocation : "",
      });
    } catch (e) {
      console.error("[book] create", e);
      return NextResponse.json({ error: "예약을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
    }
  });
}
