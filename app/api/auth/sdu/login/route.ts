import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { pendingCookieOptions, SIS_PENDING_COOKIE, sisBaseUrl } from "@/lib/auth/sis-cookie";
import { stashPending } from "@/lib/auth/sis-store";
import { finishLogin } from "@/lib/auth/sis-login";
import { SisClient } from "@/services/sdu/sis/client";

const schema = z.object({
  username: z.string().trim().min(3).max(20),
  password: z.string().min(1).max(200),
});

/**
 * POST /api/auth/sdu/login — step 1 of the real SDU sign-in.
 * Forwards the credentials to my.sdu.edu.kz (never stored). Returns whether a
 * 2-factor code is required, or signs the student straight in.
 */
export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ step: "failed", message: "Enter your student number and password." }, { status: 400 });
  }

  const client = new SisClient({ baseUrl: sisBaseUrl() });
  let result;
  try {
    result = await client.login(parsed.data.username, parsed.data.password);
  } catch (error) {
    console.error("[sis] login error:", (error as Error).message);
    return NextResponse.json({ step: "failed", message: "Couldn't reach SDU. Try again in a moment." }, { status: 502 });
  }

  if (result.step === "verify") {
    const ticket = stashPending(client);
    const response = NextResponse.json({ step: "verify", message: result.message });
    response.cookies.set(SIS_PENDING_COOKIE, ticket, pendingCookieOptions);
    return response;
  }

  if (result.step === "authenticated") {
    return finishLogin(client);
  }

  return NextResponse.json({ step: "failed", message: result.message }, { status: 401 });
}
