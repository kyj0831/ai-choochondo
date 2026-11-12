"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dateKey, gmtLabel, zonedParts } from "@/lib/booking/time";

// ---------------------------------------------------------------- types

interface PublicConfig {
  host: { name: string; title: string; company: string; initials: string };
  hostTimeZone: string;
  durations: number[];
  maxDaysAhead: number;
  offlineLocation: string;
  mode: "google" | "demo";
}

interface BookingResult {
  id: string;
  start: string;
  end: string;
  title: string;
  agenda: string[];
  agendaBy: "ai" | "rule";
  meetLink: string | null;
  htmlLink?: string;
  mode: "google" | "demo";
  location: string;
}

type Lang = "ko" | "en";

// ---------------------------------------------------------------- i18n

const T = {
  ko: {
    steps: ["날짜 선택", "정보 입력", "예약 완료"],
    available: "예약 가능",
    demo: "데모 모드",
    demoTip: "Google 캘린더가 아직 연결되지 않아 예시 일정으로 표시됩니다",
    pickTitle: "날짜와 시간을 선택하세요",
    pickSub: "예약 가능한 날짜가 표시됩니다",
    meetingLength: "미팅 시간",
    min: "분",
    timezone: "시간대",
    h12: "12시간",
    h24: "24시간",
    tzNote: "모든 시간은 선택한 시간대 기준으로 표시됩니다",
    weekdays: ["일", "월", "화", "수", "목", "금", "토"],
    monthTitle: (y: number, m: number) => `${y}년 ${m}월`,
    timeFor: (d: string) => `${d} — 시간 선택`,
    basis: "표시 기준",
    noSlots: "이 날은 예약 가능한 시간이 없습니다",
    pickDate: "왼쪽 달력에서 날짜를 선택하세요",
    loading: "캘린더 확인 중…",
    next: "다음 단계",
    aiTitle: "AI에게 말로 요청하기",
    aiPlaceholder: "예) 다음 주 화요일 오후, 금요일 오전 중에",
    aiAsk: "찾기",
    aiThinking: "빈 시간 찾는 중…",
    formTitle: "정보를 입력해주세요",
    formSub: "미팅 확정을 위해 아래 정보가 필요합니다",
    change: "변경",
    minuteMeeting: (n: number) => `${n}분 미팅`,
    name: "이름",
    namePh: "홍길동",
    email: "이메일",
    emailPh: "name@company.com",
    company: "회사",
    companyPh: "(주) 회사명",
    jobTitle: "직함",
    jobTitlePh: "개발자, 대표, 팀장 등",
    purpose: "미팅 목적",
    purposePh: "간략하게 미팅 목적을 알려주세요",
    meetingType: "미팅 방식",
    online: "온라인",
    offline: "오프라인",
    onlineNote: "Google Meet을 통해 온라인으로 진행됩니다",
    offlineNote: (loc: string) => (loc ? `${loc}에서 진행됩니다` : "장소는 확정 메일로 안내드립니다"),
    prev: "이전",
    confirm: "예약 확정하기",
    confirming: "예약하는 중…",
    required: "필수 항목을 모두 입력해 주세요",
    badEmail: "이메일 형식을 확인해 주세요",
    doneTitle: "예약이 확정되었습니다",
    doneSubGoogle: (e: string) => `${e} 으로 캘린더 초대장을 보냈습니다`,
    doneSubDemo: "데모 모드라 실제 캘린더 초대는 발송되지 않았습니다",
    meetLink: "Google Meet 링크",
    agenda: "아젠다",
    aiDraft: "AI 초안",
    place: "장소",
    bookAnother: "다른 시간 또 예약하기",
    loadError: "캘린더를 불러오지 못했습니다",
    retry: "다시 시도",
  },
  en: {
    steps: ["Pick a time", "Your details", "Confirmed"],
    available: "Available",
    demo: "Demo mode",
    demoTip: "Google Calendar is not connected yet — showing sample availability",
    pickTitle: "Select a date & time",
    pickSub: "Highlighted dates have open slots",
    meetingLength: "Duration",
    min: " min",
    timezone: "Time zone",
    h12: "12h",
    h24: "24h",
    tzNote: "All times are shown in the selected time zone",
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    monthTitle: (y: number, m: number) =>
      new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    timeFor: (d: string) => `${d} — pick a time`,
    basis: "Shown in",
    noSlots: "No open slots on this day",
    pickDate: "Pick a date on the calendar",
    loading: "Checking calendar…",
    next: "Next",
    aiTitle: "Ask AI in plain words",
    aiPlaceholder: "e.g. next Tuesday afternoon",
    aiAsk: "Find",
    aiThinking: "Finding open slots…",
    formTitle: "Enter your details",
    formSub: "We need a few details to confirm the meeting",
    change: "Change",
    minuteMeeting: (n: number) => `${n}-minute meeting`,
    name: "Name",
    namePh: "Jane Doe",
    email: "Email",
    emailPh: "name@company.com",
    company: "Company",
    companyPh: "Company Inc.",
    jobTitle: "Job title",
    jobTitlePh: "Engineer, CEO, Team lead…",
    purpose: "Purpose",
    purposePh: "Briefly tell us what you'd like to discuss",
    meetingType: "Meeting type",
    online: "Online",
    offline: "In person",
    onlineNote: "Held online via Google Meet",
    offlineNote: (loc: string) => (loc ? `Held at ${loc}` : "Location will be shared by email"),
    prev: "Back",
    confirm: "Confirm booking",
    confirming: "Booking…",
    required: "Please fill in all required fields",
    badEmail: "Please check your email address",
    doneTitle: "You're booked!",
    doneSubGoogle: (e: string) => `A calendar invite was sent to ${e}`,
    doneSubDemo: "Demo mode — no real calendar invite was sent",
    meetLink: "Google Meet link",
    agenda: "Agenda",
    aiDraft: "AI draft",
    place: "Location",
    bookAnother: "Book another time",
    loadError: "Couldn't load the calendar",
    retry: "Retry",
  },
} as const;

// ---------------------------------------------------------------- time helpers

const TZ_CHOICES: { id: string; city: string; cityKo: string }[] = [
  { id: "Asia/Seoul", city: "Seoul", cityKo: "서울" },
  { id: "Asia/Tokyo", city: "Tokyo", cityKo: "도쿄" },
  { id: "Asia/Shanghai", city: "Shanghai", cityKo: "상하이" },
  { id: "Asia/Singapore", city: "Singapore", cityKo: "싱가포르" },
  { id: "Asia/Kolkata", city: "India", cityKo: "인도" },
  { id: "Europe/London", city: "London", cityKo: "런던" },
  { id: "Europe/Paris", city: "Paris", cityKo: "파리" },
  { id: "America/New_York", city: "New York", cityKo: "뉴욕" },
  { id: "America/Chicago", city: "Chicago", cityKo: "시카고" },
  { id: "America/Los_Angeles", city: "Los Angeles", cityKo: "LA" },
  { id: "Australia/Sydney", city: "Sydney", cityKo: "시드니" },
  { id: "UTC", city: "UTC", cityKo: "UTC" },
];

const TZ_ABBR: Record<string, string> = { "Asia/Seoul": "KST", "Asia/Tokyo": "JST", UTC: "UTC" };

function tzAbbr(tz: string, at: Date): string {
  if (TZ_ABBR[tz]) return TZ_ABBR[tz];
  const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName");
  return part?.value || gmtLabel(tz, at);
}

function tzCity(tz: string): string {
  const c = TZ_CHOICES.find((x) => x.id === tz);
  if (c) return c.city;
  return tz.split("/").pop()!.replace(/_/g, " ");
}

function fmtTime(iso: string, tz: string, hour12: boolean, lang: Lang) {
  return new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en-US", {
    timeZone: tz,
    hour: hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hourCycle: hour12 ? "h12" : "h23",
  }).format(new Date(iso));
}

function fmtDateLong(iso: string, tz: string, lang: Lang) {
  const d = new Date(iso);
  if (lang === "ko") {
    const p = zonedParts(d, tz);
    return `${p.month}월 ${p.day}일 (${T.ko.weekdays[p.weekday]})`;
  }
  return d.toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
}

/** "2026-11-17" 키를 화면용 문자열로 */
function fmtKey(key: string, lang: Lang) {
  const [y, m, d] = key.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return lang === "ko"
    ? `${m}월 ${d}일 (${T.ko.weekdays[wd]})`
    : new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
      });
}

function detectTz(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Seoul";
  } catch {
    return "Asia/Seoul";
  }
}

// ---------------------------------------------------------------- small UI

const GREEN = "#80d97b";

function Avatar({ initials, size = 48 }: { initials: string; size?: number }) {
  return (
    <div
      className="shrink-0 rounded-full grid place-items-center font-bold text-[#0b2a0c]"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.34,
        background: "radial-gradient(circle at 30% 25%, #a6ec9f, #4fae4a)",
      }}
    >
      {initials}
    </div>
  );
}

function Stepper({ step, lang }: { step: number; lang: Lang }) {
  const labels = T[lang].steps;
  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-3 text-sm">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <li key={label} className="flex items-center gap-2 sm:gap-3">
            <span className="flex items-center gap-2">
              <span
                className={`grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full font-semibold ${
                  active
                    ? "bg-[#80d97b] text-[#0b2a0c] ring-4 ring-[#80d97b]/25"
                    : done
                    ? "bg-[#1f3d22] text-[#80d97b]"
                    : "bg-[#26262a] text-neutral-400"
                }`}
              >
                {done ? "✓" : n}
              </span>
              <span className={`${active ? "text-white font-semibold" : "text-neutral-400"} hidden sm:inline`}>
                {label}
              </span>
            </span>
            {n < labels.length && <span className="h-px w-6 sm:w-14 bg-neutral-700" />}
          </li>
        );
      })}
    </ol>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-[#2a2a2e] bg-[#151517] ${className}`}>{children}</div>;
}

function TzSelect({ value, onChange, lang, compact }: { value: string; onChange: (v: string) => void; lang: Lang; compact?: boolean }) {
  const now = useMemo(() => new Date(), []);
  const options = TZ_CHOICES.some((c) => c.id === value) ? TZ_CHOICES : [{ id: value, city: tzCity(value), cityKo: tzCity(value) }, ...TZ_CHOICES];
  return (
    <label className={`relative flex items-center rounded-xl border border-[#2a2a2e] bg-black ${compact ? "h-10" : "h-12"}`}>
      <span className="pl-3 pr-1" aria-hidden>
        🌐
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none bg-transparent pl-1 pr-7 text-[15px] text-neutral-100 outline-none truncate cursor-pointer"
        aria-label="Time zone"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-neutral-900">
            {o.city + ` (${gmtLabel(o.id, now)})`}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-3 text-[10px] text-neutral-500">▼</span>
    </label>
  );
}

// ---------------------------------------------------------------- main

export default function BookingApp() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [lang, setLang] = useState<Lang>("ko");
  const t = T[lang];
  const [tz, setTz] = useState("Asia/Seoul");
  const [hour12, setHour12] = useState(false);
  const [duration, setDuration] = useState(30);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [view, setView] = useState(() => {
    const p = zonedParts(new Date(), "Asia/Seoul");
    return { y: p.year, m: p.month };
  });
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [selDate, setSelDate] = useState<string | null>(null);
  const [selSlot, setSelSlot] = useState<string | null>(null);

  const [aiText, setAiText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReply, setAiReply] = useState<{ text: string; slots: string[] } | null>(null);

  const [form, setForm] = useState({ name: "", email: "", company: "", jobTitle: "", purpose: "", website: "" });
  const [mode, setMode] = useState<"online" | "offline">("online");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);

  // 초기화: 브라우저 시간대·언어 감지, 설정 로드
  useEffect(() => {
    const detected = detectTz();
    setTz(detected);
    const p = zonedParts(new Date(), detected);
    setView({ y: p.year, m: p.month });
    if (typeof navigator !== "undefined" && !navigator.language.toLowerCase().startsWith("ko")) setLang("en");
    fetch("/api/book/config")
      .then((r) => r.json())
      .then((c: PublicConfig) => {
        setCfg(c);
        if (c.durations?.length) setDuration(c.durations[0]);
      })
      .catch(() => setLoadError("config"));
  }, []);

  // 보이는 달의 빈 시간 로드 (앞뒤 하루 여유 — 시간대 차이로 날짜가 넘어가는 슬롯까지)
  useEffect(() => {
    if (!cfg) return;
    const start = new Date(Date.UTC(view.y, view.m - 1, 1) - 86400_000);
    const end = new Date(Date.UTC(view.y, view.m, 1) + 86400_000);
    let cancelled = false;
    setLoading(true);
    setLoadError("");
    fetch(`/api/book/availability?start=${start.toISOString()}&end=${end.toISOString()}&duration=${duration}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "error");
        return j as { slots: string[] };
      })
      .then((j) => !cancelled && setSlots(j.slots))
      .catch(() => !cancelled && (setSlots([]), setLoadError("load")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cfg, view.y, view.m, duration, reloadTick]);

  // 표시 시간대 기준으로 날짜별 묶기
  const byDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of slots) {
      const k = dateKey(new Date(s), tz);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return map;
  }, [slots, tz]);

  // 선택한 슬롯이 사라졌으면(시간 변경·재로딩) 선택 해제
  useEffect(() => {
    if (selSlot && !loading && !slots.includes(selSlot)) setSelSlot(null);
  }, [slots, selSlot, loading]);

  const todayKey = dateKey(new Date(), tz);
  const nowP = zonedParts(new Date(), tz);
  const canPrev = view.y > nowP.year || (view.y === nowP.year && view.m > nowP.month);
  const limit = zonedParts(new Date(Date.now() + (cfg?.maxDaysAhead ?? 60) * 86400_000), tz);
  const canNext = view.y < limit.year || (view.y === limit.year && view.m < limit.month);

  const moveMonth = (delta: number) => {
    const d = new Date(Date.UTC(view.y, view.m - 1 + delta, 1));
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 });
    setSelDate(null);
  };

  const pickSlot = useCallback(
    (iso: string) => {
      const k = dateKey(new Date(iso), tz);
      const [y, m] = k.split("-").map(Number);
      if (y !== view.y || m !== view.m) setView({ y, m });
      setSelDate(k);
      setSelSlot(iso);
    },
    [tz, view.y, view.m]
  );

  const askAi = async () => {
    if (!aiText.trim() || aiBusy) return;
    setAiBusy(true);
    setAiReply(null);
    try {
      const r = await fetch("/api/book/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText, duration, timeZone: tz }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setAiReply({ text: j.reply, slots: j.slots });
      if (j.slots?.[0]) pickSlot(j.slots[0]);
    } catch (e) {
      setAiReply({ text: (e as Error).message || "오류", slots: [] });
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async () => {
    setFormError("");
    const { name, email, company, jobTitle, purpose } = form;
    if (![name, email, company, jobTitle, purpose].every((v) => v.trim())) return setFormError(t.required);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setFormError(t.badEmail);
    if (!selSlot) return setStep(1);
    setSubmitting(true);
    try {
      const r = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, start: selSlot, duration, mode, timeZone: tz }),
      });
      const j = await r.json();
      if (!r.ok) {
        if (j.code === "SLOT_TAKEN") {
          setSelSlot(null);
          setReloadTick((n) => n + 1);
          setStep(1);
        }
        throw new Error(j.error || "error");
      }
      setResult(j);
      setStep(3);
      setReloadTick((n) => n + 1);
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const resetAll = () => {
    setResult(null);
    setSelSlot(null);
    setSelDate(null);
    setForm((f) => ({ ...f, purpose: "" }));
    setStep(1);
  };

  // ------------------------------------------------------------ render

  const host = cfg?.host ?? { name: "", title: "", company: "", initials: "" };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-neutral-100 antialiased">
      {/* header */}
      <header className="border-b border-[#232327] bg-[#0f0f11]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar initials={host.initials || "·"} size={44} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-[17px]">{host.name || " "}</div>
              <div className="truncate text-sm text-neutral-400">
                {host.title}
                {host.company && ` · ${host.company}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {cfg?.mode === "demo" ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-amber-300" title={t.demoTip}>
                <span className="h-2 w-2 rounded-full bg-amber-300" /> {t.demo}
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-sm text-neutral-300">
                <span className="h-2 w-2 rounded-full" style={{ background: GREEN }} /> {t.available}
              </span>
            )}
            <div className="w-44 sm:w-52">
              <TzSelect value={tz} onChange={setTz} lang={lang} compact />
            </div>
            <button
              onClick={() => setLang(lang === "ko" ? "en" : "ko")}
              className="h-10 rounded-xl border border-[#2a2a2e] px-3 text-sm text-neutral-300 hover:bg-[#1c1c1f]"
            >
              {lang === "ko" ? "EN" : "KO"}
            </button>
          </div>
        </div>
        {cfg?.mode === "demo" && (
          <div className="bg-amber-400/10 px-4 py-2 text-center text-xs text-amber-200 sm:hidden">{t.demoTip}</div>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
        <Stepper step={step} lang={lang} />

        {/* ---------------- STEP 1 ---------------- */}
        {step === 1 && (
          <>
            <div className="mt-8 text-center">
              <h1 className="text-2xl sm:text-[28px] font-bold">{t.pickTitle}</h1>
              <p className="mt-2 text-neutral-400">{t.pickSub}</p>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
              {/* left */}
              <div className="flex flex-col gap-5">
                <Card className="p-6">
                  <div className="flex items-center gap-4">
                    <Avatar initials={host.initials || "·"} size={88} />
                    <div className="min-w-0">
                      <div className="text-xl font-semibold">{host.name}</div>
                      <div className="text-neutral-300">{host.title}</div>
                      <div className="text-neutral-300">{host.company}</div>
                    </div>
                  </div>
                  <div className="mt-5 text-sm text-neutral-400">{t.meetingLength}</div>
                  <div className="mt-2 flex gap-2">
                    {(cfg?.durations ?? [30, 60]).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDuration(d)}
                        className={`h-11 rounded-xl px-5 text-[15px] font-semibold transition ${
                          d === duration
                            ? "bg-[#80d97b] text-[#0b2a0c]"
                            : "border border-[#2a2a2e] bg-black text-neutral-200 hover:bg-[#1c1c1f]"
                        }`}
                      >
                        {d}
                        {t.min}
                      </button>
                    ))}
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-neutral-400">{t.timezone}</span>
                    <div className="flex overflow-hidden rounded-lg border border-[#2a2a2e] text-sm">
                      {[true, false].map((h) => (
                        <button
                          key={String(h)}
                          onClick={() => setHour12(h)}
                          className={`px-3 py-1.5 ${hour12 === h ? "bg-[#80d97b] font-semibold text-[#0b2a0c]" : "text-neutral-300"}`}
                        >
                          {h ? t.h12 : t.h24}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4">
                    <TzSelect value={tz} onChange={setTz} lang={lang} />
                  </div>
                  <p className="mt-3 text-sm text-neutral-400">{t.tzNote}</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <span aria-hidden>✨</span> {t.aiTitle}
                  </div>
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      askAi();
                    }}
                  >
                    <input
                      value={aiText}
                      onChange={(e) => setAiText(e.target.value)}
                      placeholder={t.aiPlaceholder}
                      maxLength={300}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-[#2a2a2e] bg-black px-3 text-[15px] placeholder:text-neutral-500 outline-none focus:border-[#80d97b]"
                    />
                    <button
                      disabled={aiBusy || !aiText.trim()}
                      className="h-11 shrink-0 rounded-xl bg-[#1f3d22] px-4 text-sm font-semibold text-[#80d97b] disabled:opacity-40"
                    >
                      {t.aiAsk}
                    </button>
                  </form>
                  {aiBusy && <p className="mt-3 text-sm text-neutral-400">{t.aiThinking}</p>}
                  {aiReply && (
                    <div className="mt-3">
                      <p className="text-sm text-neutral-300">{aiReply.text}</p>
                      {aiReply.slots.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {aiReply.slots.map((s) => (
                            <button
                              key={s}
                              onClick={() => pickSlot(s)}
                              className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                                s === selSlot
                                  ? "border-[#80d97b] bg-[#1f3d22] text-[#80d97b]"
                                  : "border-[#2a2a2e] bg-black text-neutral-200 hover:border-[#80d97b]/60"
                              }`}
                            >
                              {fmtDateLong(s, tz, lang)} {fmtTime(s, tz, hour12, lang)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              </div>

              {/* right: calendar */}
              <Card className="p-5 sm:p-8">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => moveMonth(-1)}
                    disabled={!canPrev}
                    className="grid h-10 w-10 place-items-center rounded-full text-2xl text-neutral-300 hover:bg-[#222] disabled:opacity-20"
                    aria-label="previous month"
                  >
                    ‹
                  </button>
                  <div className="text-lg font-semibold">{t.monthTitle(view.y, view.m)}</div>
                  <button
                    onClick={() => moveMonth(1)}
                    disabled={!canNext}
                    className="grid h-10 w-10 place-items-center rounded-full text-2xl text-neutral-300 hover:bg-[#222] disabled:opacity-20"
                    aria-label="next month"
                  >
                    ›
                  </button>
                </div>

                <div className={`mt-6 grid grid-cols-7 gap-y-2 text-center transition ${loading ? "opacity-50" : ""}`}>
                  {t.weekdays.map((w) => (
                    <div key={w} className="pb-2 text-sm text-neutral-400">
                      {w}
                    </div>
                  ))}
                  {Array.from({ length: new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay() }).map((_, i) => (
                    <div key={`b${i}`} />
                  ))}
                  {Array.from({ length: new Date(Date.UTC(view.y, view.m, 0)).getUTCDate() }).map((_, i) => {
                    const day = i + 1;
                    const key = `${view.y}-${String(view.m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const has = byDate.has(key);
                    const selected = selDate === key;
                    const today = key === todayKey;
                    return (
                      <div key={key} className="flex justify-center">
                        <button
                          disabled={!has}
                          onClick={() => {
                            setSelDate(key);
                            setSelSlot(null);
                          }}
                          className={`grid h-11 w-11 sm:h-14 sm:w-14 place-items-center rounded-full text-[15px] sm:text-lg font-medium transition ${
                            selected
                              ? "bg-[#80d97b] text-[#0b2a0c] font-bold"
                              : has
                              ? "border border-[#2f6b33] bg-[#1b331d] text-[#86e07f] hover:bg-[#244a27]"
                              : today
                              ? "border border-neutral-700 text-neutral-200"
                              : "text-neutral-600"
                          }`}
                        >
                          {day}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {loadError && (
                  <div className="mt-6 flex items-center justify-between rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                    {t.loadError}
                    <button onClick={() => setReloadTick((n) => n + 1)} className="underline">
                      {t.retry}
                    </button>
                  </div>
                )}

                <div className="mt-6 border-t border-[#2a2a2e] pt-6">
                  {selDate ? (
                    <>
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="text-lg font-semibold text-neutral-200">{t.timeFor(fmtKey(selDate, lang))}</span>
                        <span className="text-sm text-neutral-400">
                          🌐 {t.basis} {tz} ({gmtLabel(tz)})
                        </span>
                      </div>
                      {(byDate.get(selDate) ?? []).length === 0 ? (
                        <p className="mt-4 text-neutral-400">{t.noSlots}</p>
                      ) : (
                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {(byDate.get(selDate) ?? []).map((s) => (
                            <button
                              key={s}
                              onClick={() => setSelSlot(s)}
                              className={`h-14 rounded-xl border text-lg font-semibold transition ${
                                s === selSlot
                                  ? "border-[#80d97b] bg-[#1f3d22] text-[#80d97b]"
                                  : "border-[#2a2a2e] bg-black text-neutral-100 hover:border-[#80d97b]/60"
                              }`}
                            >
                              {fmtTime(s, tz, hour12, lang)}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-neutral-500">{loading ? t.loading : t.pickDate}</p>
                  )}
                </div>
              </Card>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                disabled={!selSlot}
                onClick={() => setStep(2)}
                className="h-14 rounded-2xl bg-[#80d97b] px-8 text-lg font-semibold text-[#0b2a0c] transition disabled:bg-[#2d5a30] disabled:text-[#0b2a0c]/70"
              >
                {t.next} →
              </button>
            </div>
          </>
        )}

        {/* ---------------- STEP 2 ---------------- */}
        {step === 2 && selSlot && (
          <div className="mx-auto mt-8 max-w-[600px]">
            <div className="text-center">
              <h1 className="text-2xl sm:text-[28px] font-bold">{t.formTitle}</h1>
              <p className="mt-2 text-neutral-400">{t.formSub}</p>
            </div>

            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-[#2f6b33] bg-[#141f15] px-5 py-4">
              <span className="text-3xl" aria-hidden>
                📅
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-lg font-semibold">
                  <span style={{ color: GREEN }}>
                    {fmtDateLong(selSlot, tz, lang)} {fmtTime(selSlot, tz, hour12, lang)}
                  </span>{" "}
                  <span className="font-normal text-neutral-300">{tzAbbr(tz, new Date(selSlot))}</span>
                </div>
                <div className="text-neutral-400">{t.minuteMeeting(duration)}</div>
              </div>
              <button onClick={() => setStep(1)} className="text-sm text-neutral-300 underline underline-offset-4">
                {t.change}
              </button>
            </div>

            <form
              className="mt-8 space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {(
                [
                  ["name", t.name, t.namePh, "text", "name"],
                  ["email", t.email, t.emailPh, "email", "email"],
                  ["company", t.company, t.companyPh, "text", "organization"],
                  ["jobTitle", t.jobTitle, t.jobTitlePh, "text", "organization-title"],
                ] as const
              ).map(([key, label, ph, type, ac]) => (
                <label key={key} className="block">
                  <span className="text-[15px] font-semibold">
                    {label} <span style={{ color: GREEN }}>*</span>
                  </span>
                  <input
                    type={type}
                    autoComplete={ac}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={ph}
                    maxLength={key === "email" ? 200 : 100}
                    className="mt-2 h-14 w-full rounded-xl border border-[#2a2a2e] bg-black px-4 text-[16px] placeholder:text-neutral-500 outline-none focus:border-[#80d97b]"
                  />
                </label>
              ))}
              <label className="block">
                <span className="text-[15px] font-semibold">
                  {t.purpose} <span style={{ color: GREEN }}>*</span>
                </span>
                <textarea
                  value={form.purpose}
                  onChange={(e) => setForm({ ...form, purpose: e.target.value })}
                  placeholder={t.purposePh}
                  rows={4}
                  maxLength={2000}
                  className="mt-2 w-full resize-y rounded-xl border border-[#2a2a2e] bg-black px-4 py-3 text-[16px] placeholder:text-neutral-500 outline-none focus:border-[#80d97b]"
                />
              </label>
              {/* 봇 차단용 숨김 필드 */}
              <input
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="hidden"
                aria-hidden
              />

              <div>
                <div className="text-[15px] font-semibold">{t.meetingType}</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {(["online", "offline"] as const).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMode(m)}
                      className={`h-14 rounded-xl text-[16px] font-semibold transition ${
                        mode === m ? "bg-[#80d97b] text-[#0b2a0c]" : "border border-[#2a2a2e] bg-black text-neutral-200"
                      }`}
                    >
                      {m === "online" ? t.online : t.offline}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-neutral-400">
                  {mode === "online" ? `💻 ${t.onlineNote}` : `📍 ${t.offlineNote(cfg?.offlineLocation || "")}`}
                </p>
              </div>

              {formError && (
                <p className="rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-200">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="h-14 w-32 shrink-0 rounded-2xl border border-[#2a2a2e] text-[16px] text-neutral-200"
                >
                  {t.prev}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-14 flex-1 rounded-2xl bg-[#80d97b] text-[17px] font-bold text-[#0b2a0c] disabled:opacity-60"
                >
                  {submitting ? t.confirming : t.confirm}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ---------------- STEP 3 ---------------- */}
        {step === 3 && result && (
          <div className="mx-auto mt-10 max-w-[600px] text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#80d97b] text-3xl font-bold text-[#0b2a0c]">
              ✓
            </div>
            <h1 className="mt-5 text-2xl sm:text-[28px] font-bold">{t.doneTitle}</h1>
            <p className="mt-2 text-neutral-400">
              {result.mode === "google" ? t.doneSubGoogle(form.email) : t.doneSubDemo}
            </p>

            <Card className="mt-8 p-6 text-left">
              <div className="text-lg font-semibold">{result.title}</div>
              <div className="mt-2" style={{ color: GREEN }}>
                {fmtDateLong(result.start, tz, lang)} {fmtTime(result.start, tz, hour12, lang)} –{" "}
                {fmtTime(result.end, tz, hour12, lang)}{" "}
                <span className="text-neutral-400">{tzAbbr(tz, new Date(result.start))}</span>
              </div>
              <div className="mt-1 text-sm text-neutral-400">
                {host.name} · {host.company}
              </div>

              {result.meetLink && (
                <a
                  href={result.meetLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 flex items-center justify-between rounded-xl border border-[#2f6b33] bg-[#141f15] px-4 py-3 text-sm"
                >
                  <span>💻 {t.meetLink}</span>
                  <span className="truncate pl-3" style={{ color: GREEN }}>
                    {result.meetLink.replace(/^https?:\/\//, "")}
                  </span>
                </a>
              )}
              {!result.meetLink && mode === "offline" && (
                <div className="mt-4 text-sm text-neutral-300">
                  📍 {t.place}: {result.location || t.offlineNote("")}
                </div>
              )}

              <div className="mt-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-300">
                  {t.agenda}
                  {result.agendaBy === "ai" && (
                    <span className="rounded-md bg-[#1f3d22] px-1.5 py-0.5 text-[11px] text-[#80d97b]">✨ {t.aiDraft}</span>
                  )}
                </div>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-neutral-200">
                  {result.agenda.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ol>
              </div>
            </Card>

            <button onClick={resetAll} className="mt-8 text-sm text-neutral-400 underline underline-offset-4">
              {t.bookAnother}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
