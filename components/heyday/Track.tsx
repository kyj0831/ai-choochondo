"use client";

import { useEffect } from "react";

/**
 * 화면 도달·선택을 기록한다.
 *
 * 이 MVP의 North Star는 "가격을 본 사용자가 예약을 요청하는가"이고,
 * 그 비율은 화면 도달 기록 없이는 계산할 수 없다.
 * 수집하는 것은 세션 식별자와 화면 이름뿐 — 개인정보는 예약 요청 폼에서만 받는다.
 */

const sent = new Set<string>();

export function sessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem("heyday_sid");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("heyday_sid", id);
    }
    return id;
  } catch {
    // 시크릿 모드 등에서 저장소가 막혀 있어도 흐름은 멈추지 않는다.
    return "no-storage";
  }
}

export function track(name: string, props: Record<string, unknown> = {}) {
  const body = JSON.stringify({ sessionId: sessionId(), name, props });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/heyday/events", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {
    /* sendBeacon이 막히면 fetch로 넘어간다 */
  }
  fetch("/api/heyday/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    /* 기록 실패가 예약을 막아서는 안 된다 */
  });
}

export default function Track({
  event,
  props = {},
}: {
  event: string;
  props?: Record<string, unknown>;
}) {
  const key = `${event}:${JSON.stringify(props)}`;
  useEffect(() => {
    if (sent.has(key)) return; // StrictMode 이중 실행 방지
    sent.add(key);
    track(event, props);
    // key 하나로 이벤트·속성 변화를 모두 대표한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return null;
}
