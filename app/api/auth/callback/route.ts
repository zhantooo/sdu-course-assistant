import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/api/http";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/token";
import { getSduApi, isSduApiError } from "@/services/sduApi";

/**
 * GET /api/auth/callback?ticket=ST-… — CAS returns here after sign-in.
 * Validates the service ticket server-to-server, confirms the student can
 * register, then issues our own short-lived session cookie.
 */
export async function GET(request: NextRequest) {
  const origin = appOrigin(request);
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, origin));

  const ticket = request.nextUrl.searchParams.get("ticket");
  if (!ticket) return fail("missing_ticket");

  const sdu = getSduApi();
  // Must match the service URL sent to CAS byte-for-byte.
  const serviceUrl = new URL("/api/auth/callback", origin).toString();

  try {
    const { studentId } = await sdu.validateServiceTicket(ticket, serviceUrl);
    const profile = await sdu.getStudentProfile(studentId);
    if (profile.academicStatus === "SUSPENDED" || profile.academicStatus === "GRADUATED") {
      return fail("not_eligible");
    }

    const token = await createSessionToken({ studentId, fullName: profile.fullName, role: "STUDENT" });
    const response = NextResponse.redirect(new URL("/dashboard", origin));
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return response;
  } catch (error) {
    if (isSduApiError(error)) {
      console.warn(`[auth] SSO failed: ${error.code} ${error.message}`);
      return fail(error.status === 401 || error.status === 404 ? "invalid_credentials" : "sso_unavailable");
    }
    console.error(error);
    return fail("sso_unavailable");
  }
}
