import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/token";
import { SIS_PENDING_COOKIE } from "@/lib/auth/sis-cookie";
import { openSession } from "@/lib/auth/sis-store";
import type { SisClient } from "@/services/sdu/sis/client";

/**
 * Opens a durable SIS + app session for an authenticated client and sets the
 * cookie. The student id comes from the number used to sign in (reliable); the
 * full profile and transcript are loaded lazily by the dashboard, so a parsing
 * hiccup there never blocks sign-in.
 */
export async function finishLogin(client: SisClient) {
  const studentId = client.studentId;
  if (!studentId) {
    return NextResponse.json({ step: "failed", message: "Signed in, but your student number was missing." }, { status: 502 });
  }

  const fullName = await client.getDisplayName();
  openSession(studentId, client);

  const token = await createSessionToken({ studentId, fullName, role: "STUDENT" });
  const response = NextResponse.json({ step: "authenticated" });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  response.cookies.delete(SIS_PENDING_COOKIE);
  return response;
}
