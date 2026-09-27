import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { SIS_PENDING_COOKIE } from "@/lib/auth/sis-cookie";
import { dropPending, takePending } from "@/lib/auth/sis-store";
import { finishLogin } from "@/lib/auth/sis-login";

const schema = z.object({ code: z.string().trim().min(3).max(12) });

/** POST /api/auth/sdu/verify — step 2: submit the emailed 2-factor code. */
export async function POST(request: NextRequest) {
  const ticket = request.cookies.get(SIS_PENDING_COOKIE)?.value;
  const client = takePending(ticket);
  if (!client) {
    return NextResponse.json({ step: "failed", message: "Sign-in expired. Please start again." }, { status: 440 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ step: "failed", message: "Enter the code from your email." }, { status: 400 });
  }

  let result;
  try {
    result = await client.verify(parsed.data.code);
  } catch (error) {
    console.error("[sis] verify error:", (error as Error).message);
    return NextResponse.json({ step: "failed", message: "Couldn't reach SDU. Try again." }, { status: 502 });
  }

  if (result.step === "authenticated") {
    dropPending(ticket);
    return finishLogin(client);
  }
  return NextResponse.json({ step: "failed", message: result.message }, { status: 401 });
}
