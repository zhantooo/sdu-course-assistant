/**
 * Mirrors SDU data into PostgreSQL. Idempotent: safe to run repeatedly
 * (seed script today; scheduled job + post-login hook later).
 */
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { termLabel } from "@/lib/env";
import type { SduApiClient } from "@/services/sduApi";

/**
 * Approximate term calendar derived from the code. Replace with SDU's
 * academic calendar endpoint once available.
 */
function termDates(termCode: string) {
  const [yearText, season] = termCode.split("-");
  const year = Number(yearText);
  switch (season) {
    case "SPRING":
      return { startsOn: new Date(Date.UTC(year, 0, 15)), endsOn: new Date(Date.UTC(year, 4, 31)) };
    case "SUMMER":
      return { startsOn: new Date(Date.UTC(year, 5, 1)), endsOn: new Date(Date.UTC(year, 7, 15)) };
    default:
      return { startsOn: new Date(Date.UTC(year, 8, 1)), endsOn: new Date(Date.UTC(year, 11, 31)) };
  }
}

export async function syncDepartments(db: PrismaClient, sdu: SduApiClient) {
  const departments = await sdu.getDepartments();
  for (const d of departments) {
    await db.department.upsert({
      where: { code: d.code },
      create: { code: d.code, name: d.name, faculty: d.faculty },
      update: { name: d.name, faculty: d.faculty },
    });
  }
  return departments.length;
}

export async function syncCatalog(db: PrismaClient, sdu: SduApiClient, termCode: string) {
  const courses = await sdu.getCatalog(termCode);
  const departments = new Map((await db.department.findMany()).map((d) => [d.code, d.id]));

  const term = await db.term.upsert({
    where: { code: termCode },
    create: { code: termCode, name: termLabel(termCode), ...termDates(termCode), isCurrent: true },
    update: { isCurrent: true },
  });
  await db.term.updateMany({ where: { code: { not: termCode } }, data: { isCurrent: false } });

  const courseIds = new Map<string, string>();
  for (const c of courses) {
    const departmentId = departments.get(c.departmentCode);
    if (!departmentId) throw new Error(`Unknown department ${c.departmentCode} for ${c.code}; sync departments first`);
    const data = { title: c.title, description: c.description, credits: c.credits, level: c.level, departmentId };
    const row = await db.course.upsert({ where: { code: c.code }, create: { code: c.code, ...data }, update: data });
    courseIds.set(c.code, row.id);
  }

  // Prerequisites may reference courses not offered this term (e.g. MAT 101).
  const ensureCourse = async (code: string) => {
    const known = courseIds.get(code) ?? (await db.course.findUnique({ where: { code } }))?.id;
    if (known) return known;
    const departmentId = departments.get(code.split(" ")[0]);
    if (!departmentId) throw new Error(`Cannot create placeholder for ${code}: unknown department`);
    const row = await db.course.create({
      data: { code, title: code, credits: 0, level: Number(code.split(" ")[1]?.[0] ?? 1) * 100, departmentId },
    });
    courseIds.set(code, row.id);
    return row.id;
  };

  for (const c of courses) {
    const courseId = courseIds.get(c.code)!;
    const rows = [];
    for (const [groupIndex, group] of c.prerequisites.entries()) {
      for (const code of group) {
        rows.push({ courseId, requiredCourseId: await ensureCourse(code), groupNo: groupIndex + 1 });
      }
    }
    await db.$transaction([
      db.prerequisite.deleteMany({ where: { courseId } }),
      db.prerequisite.createMany({ data: rows }),
    ]);
  }

  let sectionCount = 0;
  for (const c of courses) {
    for (const s of c.sections) {
      const instructor =
        (await db.instructor.findFirst({ where: { fullName: s.instructorName } })) ??
        (await db.instructor.create({
          data: { fullName: s.instructorName, departmentId: departments.get(c.departmentCode) },
        }));
      const data = {
        courseId: courseIds.get(c.code)!,
        termId: term.id,
        sectionNumber: s.sectionNumber,
        instructorId: instructor.id,
        totalCapacity: s.totalCapacity,
        enrolledCount: s.totalCapacity - s.availableSeats,
        waitlistCount: s.waitlistCount,
        lastSyncedAt: new Date(),
      };
      const section = await db.section.upsert({
        where: { sduSectionId: s.id },
        create: { sduSectionId: s.id, ...data },
        update: data,
      });
      await db.$transaction([
        db.meeting.deleteMany({ where: { sectionId: section.id } }),
        db.meeting.createMany({
          data: s.meetings.map((m) => ({
            sectionId: section.id,
            day: m.day,
            startMinute: m.start,
            endMinute: m.end,
            kind: m.kind,
            classroom: m.classroom,
          })),
        }),
      ]);
      sectionCount++;
    }
  }

  return { courses: courses.length, sections: sectionCount };
}

export async function syncStudent(db: PrismaClient, sdu: SduApiClient, studentId: string) {
  const [profile, transcript] = await Promise.all([sdu.getStudentProfile(studentId), sdu.getTranscript(studentId)]);
  const departments = new Map((await db.department.findMany()).map((d) => [d.code, d.id]));

  const departmentId = departments.get(profile.departmentCode);
  if (!departmentId) throw new Error(`Unknown department ${profile.departmentCode}`);

  const program = await db.program.upsert({
    where: { code: profile.program.code },
    create: { code: profile.program.code, name: profile.program.name, requiredCredits: profile.requiredCredits, departmentId },
    update: { name: profile.program.name, requiredCredits: profile.requiredCredits },
  });

  const advisor = profile.advisor
    ? await db.staffMember.upsert({
        where: { sduStaffId: profile.advisor.staffId },
        create: {
          sduStaffId: profile.advisor.staffId,
          email: profile.advisor.email,
          fullName: profile.advisor.fullName,
          role: "ADVISOR",
          departmentId,
        },
        update: { fullName: profile.advisor.fullName, email: profile.advisor.email },
      })
    : null;

  const studentData = {
    email: profile.email,
    fullName: profile.fullName,
    programId: program.id,
    studyYear: profile.studyYear,
    academicStatus: profile.academicStatus,
    gpa: profile.gpa,
    completedCredits: profile.completedCredits,
    advisorId: advisor?.id ?? null,
    lastSyncedAt: new Date(),
  };
  const student = await db.student.upsert({
    where: { sduStudentId: profile.studentId },
    create: { sduStudentId: profile.studentId, ...studentData },
    update: studentData,
  });

  for (const entry of transcript.entries) {
    const deptId = departments.get(entry.courseCode.split(" ")[0]);
    if (!deptId) throw new Error(`Unknown department for transcript course ${entry.courseCode}`);
    // Courses no longer offered only exist via transcripts; fill in placeholders
    // (credits 0) that the catalog sync created for prerequisite references.
    const existing = await db.course.findUnique({ where: { code: entry.courseCode } });
    const course =
      existing && existing.credits > 0
        ? existing
        : await db.course.upsert({
            where: { code: entry.courseCode },
            create: {
              code: entry.courseCode,
              title: entry.courseTitle,
              credits: entry.credits,
              level: Number(entry.courseCode.split(" ")[1]?.[0] ?? 1) * 100,
              departmentId: deptId,
            },
            update: { title: entry.courseTitle, credits: entry.credits },
          });
    const data = {
      letterGrade: entry.letterGrade,
      gradePoints: entry.gradePoints,
      credits: entry.credits,
      status: entry.status,
    };
    await db.transcriptEntry.upsert({
      where: { studentId_courseId_termCode: { studentId: student.id, courseId: course.id, termCode: entry.termCode } },
      create: { studentId: student.id, courseId: course.id, termCode: entry.termCode, ...data },
      update: data,
    });
  }

  return { studentId: profile.studentId, transcriptEntries: transcript.entries.length };
}
