import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withSession } from "@/lib/api/http";
import { isDbEnabled } from "@/lib/data/db-source";
import { getDb } from "@/lib/db";

const schema = z.object({ sectionId: z.string() });

/**
 * POST /api/waitlist/join — add the student to a full section's waitlist.
 * Only a genuinely full section can be waitlisted; an open one should be
 * registered directly. The entry is marked `autoEnroll`, so /process can claim
 * a freed seat later when it still fits the student's schedule.
 */
export const POST = withSession(async (request, session) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "INVALID_REQUEST", "Send the section id.");
  if (!isDbEnabled()) return jsonError(503, "NO_DB", "The waitlist needs the database.");

  const db = getDb();
  const [student, section] = await Promise.all([
    db.student.findUnique({ where: { sduStudentId: session.studentId }, select: { id: true } }),
    db.section.findUnique({
      where: { sduSectionId: parsed.data.sectionId },
      select: { id: true, sectionNumber: true, totalCapacity: true, enrolledCount: true, course: { select: { code: true } } },
    }),
  ]);
  if (!student || !section) return jsonError(404, "NOT_FOUND", "Student or section not found.");
  if (section.enrolledCount < section.totalCapacity) {
    return jsonError(409, "NOT_FULL", "This section still has open seats — register directly.");
  }

  const active = await db.waitlistEntry.count({ where: { sectionId: section.id, status: "ACTIVE" } });
  const label = `${section.course.code} §${section.sectionNumber}`;
  const entry = await db.waitlistEntry.upsert({
    where: { studentId_sectionId: { studentId: student.id, sectionId: section.id } },
    create: {
      studentId: student.id,
      sectionId: section.id,
      position: active + 1,
      status: "ACTIVE",
      autoEnroll: true,
      studentNo: session.studentId,
      course: label,
    },
    update: { status: "ACTIVE", studentNo: session.studentId, course: label },
    select: { position: true },
  });
  return NextResponse.json({ ok: true, position: entry.position, course: label });
});
