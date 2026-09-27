import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/token";

/**
 * Optimistic auth gate: signed-out visitors are redirected to /login before
 * any page renders. API routes and pages still verify the session themselves.
 */
export async function proxy(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!session && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/dashboard/:path*", "/transcript/:path*"],
};
