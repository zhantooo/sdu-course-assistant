import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withSession } from "@/lib/api/http";
import { getSisClient } from "@/lib/auth/sis-store";
import { getDb } from "@/lib/db";
import type { BatchSubmitResult } from "@/lib/domain/types";
import { getEnv } from "@/lib/env";
import { getSduApi, isSduApiError } from "@/services/sduApi";

const schema = z.object({ sectionIds: z.array(z.string()).min(1).max(15) });

/**
 * Mirror a committed registration into the local Postgres so the registrar
 * tables reflect it: each enrolled section's `enrolledCount` goes up by one and
 * an `enrollments` row is written. Best-effort only — it runs when a database
 * is configured (local dev), is idempotent, and never fails the request (the
 * deployed demo has no DB, so it simply no-ops there).
 */
async function mirrorRegistrationToDb(sduStudentId: string, result: BatchSubmitResult): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const sduSectionIds = result.results.filter((r) => r.outcome === "ENROLLED").map((r) => r.sectionId);
  if (sduSectionIds.length === 0) return;
  try {
    const db = getDb();
    const student = await db.student.findUnique({ where: { sduStudentId }, select: { id: true } });
    if (!student) return;
    for (const sduSectionId of sduSectionIds) {
      const section = await db.section.findUnique({ where: { sduSectionId }, select: { id: true } });
      if (!section) continue;
      const existing = await db.enrollment.findUnique({
        where: { studentId_sectionId: { studentId: student.id, sectionId: section.id } },
        select: { status: true },
      });
      if (existing?.status === "ENROLLED") continue; // already counted — stay idempotent
      await db.$transaction([
        db.enrollment.upsert({
          where: { studentId_sectionId: { studentId: student.id, sectionId: section.id } },
          create: { studentId: student.id, sectionId: section.id, status: "ENROLLED" },
          update: { status: "ENROLLED", droppedAt: null },
        }),
        db.section.update({
          where: { id: section.id },
          data: { enrolledCount: { increment: 1 }, lastSyncedAt: new Date() },
        }),
      ]);
    }
  } catch (error) {
    // The DB is a mirror; a write failure must never block the registration.
    console.warn("[registration] DB mirror skipped:", (error as Error).message);
  }
}

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
    if (result.committed) await mirrorRegistrationToDb(session.studentId, result);
    return NextResponse.json(result);
  } catch (error) {
    if (isSduApiError(error)) return jsonError(error.status >= 500 ? 502 : error.status, error.code, error.message);
    console.error(error);
    return jsonError(500, "INTERNAL_ERROR", "Couldn't submit your registration.");
  }
});
