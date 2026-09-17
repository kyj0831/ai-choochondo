"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sessionId, track } from "@/components/heyday/Track";

/**
 * 예약 요청 폼.
 *
 * 회원가입을 받지 않는다(PRD 13장). 메이트가 연락하려면 이름과 번호가
 * 있어야 하므로 그 둘만 받고, 왜 받는지를 바로 옆에 적는다.
 */
export default function RequestForm(props: {
  mateId: string;
  mateName: string;
  activityId: string;
  activityLabel: string;
  district: string;
  date: string;
  dateText: string;
  slot: string;
  slotText: string;
  price: number;
  durationMin: number;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) return setError("이름을 적어주세요.");
    const digits = phone.replace(/[^0-9]/g, "");
    if (digits.length < 10 || digits.length > 11) {
      return setError("연락처를 다시 확인해 주세요. 예) 010-1234-5678");
    }

    setSending(true);
    try {
      const res = await fetch("/api/heyday/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId(),
          mateId: props.mateId,
          activityId: props.activityId,
          district: props.district,
          date: props.date,
          slot: props.slot,
          guestName: name.trim(),
          guestPhone: phone,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSending(false);
        return setError(data.error ?? "잠시 후 다시 시도해 주세요.");
      }
      track("booking_requested", {
        mate: props.mateId,
        activity: props.activityId,
        district: props.district,
        price: props.price,
      });
      router.push(`/heyday/done/${data.id}`);
    } catch {
      setSending(false);
      setError("연결이 끊겼어요. 다시 한 번 눌러주세요.");
    }
  }

  return (
    <form onSubmit={submit} className="mt-7">
      <label className="hd-label" htmlFor="hd-name">
        이름
      </label>
      <input
        id="hd-name"
        className="hd-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="홍길동"
        autoComplete="name"
        enterKeyHint="next"
      />

      <label className="hd-label mt-5" htmlFor="hd-phone">
        연락처
      </label>
      <input
        id="hd-phone"
        className="hd-input"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="010-1234-5678"
        inputMode="numeric"
        autoComplete="tel"
      />
      <p className="mt-2 text-[14px] text-ink-400">
        {props.mateName} 메이트가 가능 여부를 확인해 연락드리는 데만 사용합니다.
      </p>

      <label className="hd-label mt-5" htmlFor="hd-note">
        메이트에게 하고 싶은 말 <span className="font-medium text-ink-400">(선택)</span>
      </label>
      <textarea
        id="hd-note"
        className="hd-input min-h-[110px]"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="예) 유튜브를 시작하고 싶은데 뭐부터 할지 모르겠어요. 다른 날짜도 괜찮습니다."
      />

      {error && (
        <p className="mt-4 rounded-2xl bg-heyday-50 px-4 py-3 text-[16px] font-bold text-heyday-700">
          {error}
        </p>
      )}

      <div className="mt-7">
        <button type="submit" className="hd-btn-primary" disabled={sending}>
          {sending ? "보내는 중..." : "예약 요청 보내기"}
        </button>
        <p className="mt-3 text-center text-[14px] leading-relaxed text-ink-400">
          지금 결제하지 않습니다. 메이트가 확인한 뒤 연락드리고, 그때 확정합니다.
        </p>
      </div>
    </form>
  );
}
