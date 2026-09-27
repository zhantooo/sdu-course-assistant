import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/api/http";
import { getSduApi } from "@/services/sduApi";

/**
 * GET /api/auth/login — starts SDU SSO.
 * Live: redirects to CAS. Mock: `?student_id=` picks the fake identity.
 */
export async function GET(request: NextRequest) {
  const sdu = getSduApi();
  const origin = appOrigin(request);
  const serviceUrl = new URL("/api/auth/callback", origin).toString();
  const studentId = request.nextUrl.searchParams.get("student_id")?.trim();

  if (sdu.mode === "mock" && !studentId) {
    return NextResponse.redirect(new URL("/login?error=missing_student_id", origin));
  }
  return NextResponse.redirect(sdu.buildLoginUrl(serviceUrl, { mockStudentId: studentId }));
}
