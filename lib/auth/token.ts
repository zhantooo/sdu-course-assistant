/** Session token primitives — no Next.js request APIs, so the proxy can import them. */
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "sdu_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8; // one registration working day

export interface Session {
  studentId: string;
  fullName: string;
  role: "STUDENT";
}

const DEV_FALLBACK_SECRET = "dev-only-insecure-session-secret-change-me-please";

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return new TextEncoder().encode(secret ?? DEV_FALLBACK_SECRET);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ name: session.fullName, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.studentId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || payload.role !== "STUDENT") return null;
    return { studentId: payload.sub, fullName: String(payload.name ?? ""), role: "STUDENT" };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
