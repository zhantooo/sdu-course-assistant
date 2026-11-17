import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withSession } from "@/lib/api/http";
import { isDbEnabled } from "@/lib/data/db-source";
import { getDb } from "@/lib/db";

const schema = z.object({ sectionId: z.string() });

/**
 * POST /api/waitlist/leave — the student leaves a section's waitlist.
 * The entry is marked CANCELLED (kept for history, inert to the auto-enroll
 * pass) rather than deleted, so the lifecycle is visible in the database.
 */
export const POST = withSession(async (request, session) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "INVALID_REQUEST", "Send the section id.");
  if (!isDbEnabled()) return NextResponse.json({ ok: true });

  const db = getDb();
  const [student, section] = await Promise.all([
    db.student.findUnique({ where: { sduStudentId: session.studentId }, select: { id: true } }),
    db.section.findUnique({ where: { sduSectionId: parsed.data.sectionId }, select: { id: true } }),
  ]);
  if (!student || !section) return jsonError(404, "NOT_FOUND", "Student or section not found.");

  await db.waitlistEntry.updateMany({
    where: { studentId: student.id, sectionId: section.id, status: "ACTIVE" },
    data: { status: "CANCELLED" },
  });
  return NextResponse.json({ ok: true });
});
