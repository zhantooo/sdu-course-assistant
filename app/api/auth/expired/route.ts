import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/api/http";
import { SESSION_COOKIE } from "@/lib/auth/token";

/**
 * GET /api/auth/expired — the live SDU session ended, so clear our own session
 * cookie and send the student to sign in again (no redirect loop).
 */
export async function GET(request: NextRequest) {
  const url = new URL("/login?error=session_expired", appOrigin(request));
  const response = NextResponse.redirect(url, { status: 303 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
