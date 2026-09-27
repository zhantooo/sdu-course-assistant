import { NextResponse, type NextRequest } from "next/server";
import { appOrigin } from "@/lib/api/http";
import { getSession } from "@/lib/auth/session";
import { closeSession } from "@/lib/auth/sis-store";
import { SESSION_COOKIE } from "@/lib/auth/token";

/** POST /api/auth/logout — clears our session and drops the live SIS session. */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (session) closeSession(session.studentId);

  const loginUrl = new URL("/login", appOrigin(request)).toString();
  const response = NextResponse.redirect(loginUrl, { status: 303 });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
