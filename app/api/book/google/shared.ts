import { NextRequest } from "next/server";

export function redirectUri(req: NextRequest): string {
  const base = process.env.BOOKING_BASE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
  return `${base}/api/book/google/callback`;
}

export function setupAllowed(req: NextRequest, alreadyConnected: boolean): boolean {
  const key = process.env.BOOKING_ADMIN_KEY?.trim();
  if (key) return req.nextUrl.searchParams.get("key") === key;
  return !alreadyConnected;
}
