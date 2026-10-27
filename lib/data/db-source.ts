/**
 * Database-backed data source. When DATABASE_URL is set, the app reads its own
 * Postgres (seeded from prisma/seed.ts) instead of the mock SDU backend, so the
 * catalog, students, transcripts and seats are genuine rows the registrar can
 * edit — the app is a standalone system, not a thin client over SDU.
 *
 * Rows are mapped into the same domain types the UI already uses, so nothing
 * above lib/data changes. Section ids are the SDU-style `sduSectionId` so the
 * staged-plan and registration flows stay compatible with mock mode.
 */
import { getDb } from "@/lib/db";
import type {
  Course,
  Department,
  Meeting,
  PrerequisiteRule,
  SeatAvailability,
  Section,
  StudentProfile,
  Transcript,
} from "@/lib/domain/types";

/** Whether to serve data from the local database rather than the mock backend. */
export function isDbEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

function toSection(s: {
  sduSectionId: string;
  sectionNumber: string;
  totalCapacity: number;
  enrolledCount: number;
  waitlistCount: number;
  instructor: { fullName: string } | null;
  meetings: { day: string; startMinute: number; endMinute: number; kind: string; classroom: string }[];
  course: { code: string };
}): Section {
  return {
    id: s.sduSectionId,
    courseCode: s.course.code,
    sectionNumber: s.sectionNumber,
    instructorName: s.instructor?.fullName ?? "TBA",
    totalCapacity: s.totalCapacity,
    availableSeats: Math.max(0, s.totalCapacity - s.enrolledCount),
    waitlistCount: s.waitlistCount,
    meetings: s.meetings
      .map(
        (m): Meeting => ({
          day: m.day as Meeting["day"],
          start: m.startMinute,
          end: m.endMinute,
          kind: m.kind as Meeting["kind"],
          classroom: m.classroom,
        }),
      )
      .sort((a, b) => a.start - b.start),
  };
}

/** Prerequisite rows → conjunctive normal form (rows sharing groupNo are OR; groups are AND). */
function toPrerequisites(rows: { groupNo: number; requiredCourse: { code: string } }[]): PrerequisiteRule {
  const byGroup = new Map<number, string[]>();
  for (const r of rows) {
    const arr = byGroup.get(r.groupNo) ?? [];
    arr.push(r.requiredCourse.code);
    byGroup.set(r.groupNo, arr);
  }
  return [...byGroup.entries()].sort(([a], [b]) => a - b).map(([, codes]) => codes);
}

/** Full published catalog for a term, as domain Courses with their sections. */
export async function dbGetCatalog(termCode: string): Promise<{ courses: Course[]; departments: Department[] }> {
  const db = getDb();
  const [courses, departments] = await Promise.all([
    db.course.findMany({
      where: { isActive: true, sections: { some: { term: { code: termCode } } } },
      include: {
        department: { select: { code: true } },
        prerequisites: { include: { requiredCourse: { select: { code: true } } } },
        sections: {
          where: { term: { code: termCode } },
          include: { instructor: { select: { fullName: true } }, meetings: true },
          orderBy: { sectionNumber: "asc" },
        },
      },
      orderBy: { code: "asc" },
    }),
    db.department.findMany({ orderBy: { code: "asc" } }),
  ]);

  return {
    courses: courses.map(
      (c): Course => ({
        code: c.code,
        title: c.title,
        description: c.description,
        credits: c.credits,
        departmentCode: c.department.code,
        level: c.level,
        prerequisites: toPrerequisites(c.prerequisites),
        sections: c.sections.map((s) => toSection({ ...s, course: { code: c.code } })),
      }),
    ),
    departments: departments.map((d): Department => ({ code: d.code, name: d.name, faculty: d.faculty })),
  };
}

/** A student's profile and transcript, keyed by SDU student number. */
export async function dbGetSnapshot(
  studentId: string,
): Promise<{ profile: StudentProfile; transcript: Transcript } | null> {
  const db = getDb();
  const student = await db.student.findUnique({
    where: { sduStudentId: studentId },
    include: {
      program: { include: { department: { select: { code: true, faculty: true } } } },
      advisor: { select: { sduStaffId: true, fullName: true, email: true } },
      transcript: { include: { course: { select: { code: true, title: true } } } },
    },
  });
  if (!student) return null;

  const profile: StudentProfile = {
    studentId: student.sduStudentId,
    fullName: student.fullName,
    email: student.email,
    faculty: student.program.department.faculty,
    departmentCode: student.program.department.code,
    program: { code: student.program.code, name: student.program.name },
    studyYear: student.studyYear,
    gpa: Number(student.gpa),
    completedCredits: student.completedCredits,
    requiredCredits: student.program.requiredCredits,
    academicStatus: student.academicStatus as StudentProfile["academicStatus"],
    advisor: student.advisor
      ? { staffId: student.advisor.sduStaffId, fullName: student.advisor.fullName, email: student.advisor.email }
      : null,
  };

  const transcript: Transcript = {
    studentId: student.sduStudentId,
    completedCredits: student.completedCredits,
    cumulativeGpa: Number(student.gpa),
    entries: student.transcript.map((e) => ({
      courseCode: e.course.code,
      courseTitle: e.course.title,
      credits: e.credits,
      termCode: e.termCode,
      letterGrade: e.letterGrade,
      gradePoints: e.gradePoints !== null ? Number(e.gradePoints) : null,
      status: e.status as Transcript["entries"][number]["status"],
    })),
  };

  return { profile, transcript };
}

/** Live seat counts for a term, optionally narrowed to specific section ids. */
export async function dbGetSeatAvailability(termCode: string, sectionIds?: string[]): Promise<SeatAvailability[]> {
  const db = getDb();
  const sections = await db.section.findMany({
    where: {
      term: { code: termCode },
      ...(sectionIds && sectionIds.length > 0 ? { sduSectionId: { in: sectionIds } } : {}),
    },
    select: { sduSectionId: true, totalCapacity: true, enrolledCount: true, waitlistCount: true },
  });
  return sections.map((s) => ({
    sectionId: s.sduSectionId,
    availableSeats: Math.max(0, s.totalCapacity - s.enrolledCount),
    totalCapacity: s.totalCapacity,
    waitlistCount: s.waitlistCount,
  }));
}
