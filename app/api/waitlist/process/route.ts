import { NextResponse } from "next/server";
import { withSession } from "@/lib/api/http";
import { dbGetCatalog, dbGetSnapshot, isDbEnabled } from "@/lib/data/db-source";
import { getDb } from "@/lib/db";
import type { Section } from "@/lib/domain/types";
import { getEnv } from "@/lib/env";
import { creditLimitFor } from "@/lib/registration/credits";
import { passedCourseCodes } from "@/lib/registration/prerequisites";
import { canAutoEnroll } from "@/lib/registration/waitlist";

/**
 * POST /api/waitlist/process — the smart auto-enroll pass.
 *
 * For each of the student's active, auto-enroll waitlist entries, it checks
 * (against their real enrolments, with the same rules engine) whether a seat is
 * now open AND the section still fits their schedule and credit limit. If so, it
 * claims the seat: writes the enrolment, bumps the section count and marks the
 * waitlist entry enrolled. Returns what was claimed plus the entries still
 * waiting. Safe to call on load and after every seat change.
 */
export const POST = withSession(async (_request, session) => {
  if (!isDbEnabled()) return NextResponse.json({ enrolled: [], entries: [] });

  const db = getDb();
  const termCode = getEnv().SDU_CURRENT_TERM;
  const [snapshot, student] = await Promise.all([
    dbGetSnapshot(session.studentId),
    db.student.findUnique({ where: { sduStudentId: session.studentId }, select: { id: true } }),
  ]);
  if (!snapshot || !student) return NextResponse.json({ enrolled: [], entries: [] });

  const { courses } = await dbGetCatalog(termCode);
  const coursesByCode = new Map(courses.map((c) => [c.code, c]));
  const sectionsById = new Map(courses.flatMap((c) => c.sections.map((s) => [s.id, s] as const)));
  const passed = passedCourseCodes(snapshot.transcript);
  const limit = creditLimitFor(snapshot.profile);

  const enrollments = await db.enrollment.findMany({
    where: { studentId: student.id, status: "ENROLLED" },
    select: { section: { select: { sduSectionId: true } } },
  });
  const enrolledNow: Section[] = enrollments
    .map((e) => sectionsById.get(e.section.sduSectionId))
    .filter((s): s is Section => !!s);

  const waits = await db.waitlistEntry.findMany({
    where: { studentId: student.id, status: "ACTIVE", autoEnroll: true },
    orderBy: { position: "asc" },
    select: {
      id: true,
      section: { select: { id: true, sduSectionId: true, sectionNumber: true, course: { select: { code: true } } } },
    },
  });

  const enrolled: Array<{ sectionId: string; course: string }> = [];
  for (const w of waits) {
    const section = sectionsById.get(w.section.sduSectionId);
    if (!section) continue;
    // Never auto-enroll a course the student is already enrolled in.
    if (enrolledNow.some((s) => s.courseCode === section.courseCode)) continue;

    const ctx = { coursesByCode, passed, creditLimit: limit.max, selected: enrolledNow };
    if (!canAutoEnroll(section, ctx)) continue;

    const label = `${w.section.course.code} §${w.section.sectionNumber}`;
    try {
      await db.$transaction([
        db.enrollment.upsert({
          where: { studentId_sectionId: { studentId: student.id, sectionId: w.section.id } },
          create: { studentId: student.id, sectionId: w.section.id, status: "ENROLLED", studentNo: session.studentId, course: label },
          update: { status: "ENROLLED", droppedAt: null, studentNo: session.studentId, course: label },
        }),
        db.section.update({ where: { id: w.section.id }, data: { enrolledCount: { increment: 1 }, lastSyncedAt: new Date() } }),
        db.waitlistEntry.update({ where: { id: w.id }, data: { status: "ENROLLED" } }),
      ]);
      enrolledNow.push(section);
      enrolled.push({ sectionId: w.section.sduSectionId, course: label });
    } catch {
      // Best-effort: skip this one and keep going.
    }
  }

  const remaining = await db.waitlistEntry.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    orderBy: { position: "asc" },
    select: { position: true, course: true, section: { select: { sduSectionId: true } } },
  });

  return NextResponse.json({
    enrolled,
    entries: remaining.map((w) => ({ sectionId: w.section.sduSectionId, position: w.position, course: w.course })),
  });
});
