import { NextResponse, type NextRequest } from "next/server";
import { isSduApiError } from "@/services/sduApi";
import { getSession, type Session } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

export function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

type AuthedHandler = (request: NextRequest, session: Session) => Promise<Response>;

/** Wraps an API route: requires a session and maps SDU failures to JSON errors. */
export function withSession(handler: AuthedHandler) {
  return async (request: NextRequest): Promise<Response> => {
    const session = await getSession();
    if (!session) return jsonError(401, "UNAUTHENTICATED", "Sign in with SDU SSO first.");
    try {
      return await handler(request, session);
    } catch (error) {
      if (isSduApiError(error)) {
        console.error(`[sdu] ${error.endpoint} ${error.status} ${error.code}: ${error.message}`);
        // Upstream 5xx / contract drift is our gateway problem, not the client's.
        const status = error.status >= 500 ? 502 : error.status;
        return jsonError(status, error.code, error.message);
      }
      console.error(error);
      return jsonError(500, "INTERNAL_ERROR", "Something went wrong.");
    }
  };
}

/** Public origin for building absolute URLs (CAS service URL must be stable). */
export function appOrigin(request: NextRequest): string {
  return getEnv().APP_URL ?? request.nextUrl.origin;
}
