import { createHash } from "crypto";
import { NextRequest } from "next/server";

/**
 * Session identifier from cookie or header (for rate limiting).
 * MVP: use a header or generate from IP + user-agent if no cookie.
 */
export function getSessionId(request: NextRequest): string {
  const cookie = request.cookies.get("deluge_session")?.value;
  if (cookie) return cookie;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  const ua = request.headers.get("user-agent") ?? "";
  return hashString(`session:${ip}:${ua}`);
}

/**
 * SHA-256 hash of IP for privacy-preserving rate limiting.
 */
export function getIpHash(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  return hashString(ip);
}

function hashString(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
