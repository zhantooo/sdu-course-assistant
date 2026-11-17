import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, withSession } from "@/lib/api/http";
import { isDbEnabled } from "@/lib/data/db-source";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";

const schema = z.object({ sectionIds: z.array(z.string()).max(30) });

/**
 * POST /api/plan — mirror the student's planning cart into `staged_selections`,
 * so the cart is visible in the database rather than only in the browser.
 *
 * It reconciles the table to exactly the ids sent: rows no longer staged are
 * removed, newly staged ones are inserted. Best-effort — it no-ops when no
 * database is configured (the deployed demo) and never fails the UI.
 */
export const POST = withSession(async (request, session) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "INVALID_REQUEST", "Send the staged section ids.");
  if (!isDbEnabled()) return NextResponse.json({ ok: true, persisted: false });

  try {
    const db = getDb();
    const termCode = getEnv().SDU_CURRENT_TERM;
    const [student, term] = await Promise.all([
      db.student.findUnique({ where: { sduStudentId: session.studentId }, select: { id: true } }),
      db.term.findUnique({ where: { code: termCode }, select: { id: true } }),
    ]);
    if (!student || !term) return NextResponse.json({ ok: true, persisted: false });

    // Map the SDU-style section ids the client holds to internal section rows,
    // carrying the course code + section number for the readable label.
    const sections = parsed.data.sectionIds.length
      ? await db.section.findMany({
          where: { sduSectionId: { in: parsed.data.sectionIds }, termId: term.id },
          select: { id: true, sectionNumber: true, course: { select: { code: true } } },
        })
      : [];
    const sectionIds = sections.map((s) => s.id);

    const deleteWhere = sectionIds.length
      ? { studentId: student.id, termId: term.id, sectionId: { notIn: sectionIds } }
      : { studentId: student.id, termId: term.id };

    await db.$transaction([
      db.stagedSelection.deleteMany({ where: deleteWhere }),
      ...sections.map((s) => {
        const course = `${s.course.code} §${s.sectionNumber}`;
        return db.stagedSelection.upsert({
          where: { studentId_sectionId: { studentId: student.id, sectionId: s.id } },
          create: { studentId: student.id, sectionId: s.id, termId: term.id, studentNo: session.studentId, course },
          update: { studentNo: session.studentId, course },
        });
      }),
    ]);

    // Auto-leave the waitlist for any course the student now holds via another
    // section — no point waiting for a full section you no longer need.
    const stagedCourseCodes = [...new Set(sections.map((s) => s.course.code))];
    if (stagedCourseCodes.length > 0) {
      await db.waitlistEntry.updateMany({
        where: {
          studentId: student.id,
          status: "ACTIVE",
          sectionId: { notIn: sectionIds },
          section: { course: { code: { in: stagedCourseCodes } } },
        },
        data: { status: "CANCELLED" },
      });
    }
    return NextResponse.json({ ok: true, persisted: true, count: sectionIds.length });
  } catch (error) {
    // The cart mirror is best-effort; a write failure must never block planning.
    console.warn("[plan] staged mirror skipped:", (error as Error).message);
    return NextResponse.json({ ok: true, persisted: false });
  }
});
