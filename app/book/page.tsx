import type { Metadata } from "next";
import BookingApp from "./BookingApp";

export const metadata: Metadata = {
  title: "미팅 예약",
  description: "비어 있는 시간에 바로 미팅을 예약하세요.",
};

export default function BookPage() {
  return <BookingApp />;
}
