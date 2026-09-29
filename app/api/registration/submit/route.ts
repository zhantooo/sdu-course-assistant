import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withSession } from "@/lib/api/http";
import { getSisClient } from "@/lib/auth/sis-store";
import { getEnv } from "@/lib/env";
import { getSduApi, isSduApiError } from "@/services/sduApi";

const schema = z.object({ sectionIds: z.array(z.string()).min(1).max(15) });

/**
 * POST /api/registration/submit — confirm the reserved plan.
 *
 * Demo/mock mode runs the real atomic batch-submit semantics (all-or-nothing,
 * idempotent). For a student signed in through the live SDU SIS, actually
 * writing the enrolment is a later, carefully-gated phase (it is an
 * irreversible action), so we acknowledge the reservation without submitting.
 */
export const POST = withSession(async (request, session) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "INVALID_REQUEST", "Send the section ids to confirm.");

  // Live SIS students: don't auto-submit an irreversible registration yet.
  if (getSisClient(session.studentId)) {
    return NextResponse.json({
      committed: false,
      pending: true,
      message: "Your plan is reserved. Submitting to the live SDU portal is coming in the next phase.",
    });
  }

  try {
    const result = await getSduApi().batchSubmit({
      studentId: session.studentId,
      termCode: getEnv().SDU_CURRENT_TERM,
      sectionIds: parsed.data.sectionIds,
      idempotencyKey: crypto.randomUUID(),
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isSduApiError(error)) return jsonError(error.status >= 500 ? 502 : error.status, error.code, error.message);
    console.error(error);
    return jsonError(500, "INTERNAL_ERROR", "Couldn't submit your registration.");
  }
});
