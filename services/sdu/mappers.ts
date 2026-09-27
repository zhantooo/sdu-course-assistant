import type { z } from "zod";
import { parseClock } from "@/lib/domain/time";
import type {
  BatchSubmitResult,
  Course,
  Department,
  SeatAvailability,
  Section,
  StudentProfile,
  Transcript,
} from "@/lib/domain/types";
import type {
  sduAvailability,
  sduBatchSubmitResponse,
  sduDepartment,
  SduSection,
  SduStudentProfile,
  SduTranscript,
} from "./contracts";

/** Wire → domain translation. The only place that knows SDU field names. */

export function toStudentProfile(dto: SduStudentProfile): StudentProfile {
  return {
    studentId: dto.student_id,
    fullName: dto.full_name,
    email: dto.email,
    faculty: dto.faculty,
    departmentCode: dto.department_code,
    program: { code: dto.program_code, name: dto.program_name },
    studyYear: dto.study_year,
    gpa: dto.current_gpa,
    completedCredits: dto.completed_credits,
    requiredCredits: dto.required_credits,
    academicStatus: dto.academic_status,
    advisor: dto.advisor && {
      staffId: dto.advisor.staff_id,
      fullName: dto.advisor.full_name,
      email: dto.advisor.email,
    },
  };
}

export function toTranscript(dto: SduTranscript): Transcript {
  return {
    studentId: dto.student_id,
    completedCredits: dto.completed_credits,
    cumulativeGpa: dto.cumulative_gpa,
    entries: dto.transcript_data.map((row) => ({
      courseCode: row.course_code,
      courseTitle: row.course_title,
      credits: row.credits,
      termCode: row.term_code,
      letterGrade: row.letter_grade,
      gradePoints: row.grade_points,
      status: row.status,
    })),
  };
}

export function toDepartment(dto: z.infer<typeof sduDepartment>): Department {
  return { code: dto.department_code, name: dto.name, faculty: dto.faculty };
}

export function toSection(dto: SduSection): Section {
  return {
    id: dto.section_id,
    courseCode: dto.course_code,
    sectionNumber: dto.section_number,
    instructorName: dto.instructor_name,
    totalCapacity: dto.total_capacity,
    availableSeats: dto.available_seats,
    waitlistCount: dto.waitlist_count,
    meetings: dto.time_slots.map((slot) => ({
      day: slot.day,
      start: parseClock(slot.start_time),
      end: parseClock(slot.end_time),
      kind: slot.type,
      classroom: slot.classroom,
    })),
  };
}

/**
 * SDU exposes sections flat (one row per section, course fields repeated);
 * the UI works course-first, so group them. Course order follows first
 * appearance; sections are ordered by section number.
 */
export function toCourses(sections: SduSection[]): Course[] {
  const byCode = new Map<string, Course>();
  for (const dto of sections) {
    let course = byCode.get(dto.course_code);
    if (!course) {
      course = {
        code: dto.course_code,
        title: dto.course_title,
        description: dto.course_description,
        credits: dto.credits,
        departmentCode: dto.department_code,
        level: dto.course_level,
        prerequisites: dto.prerequisites,
        sections: [],
      };
      byCode.set(dto.course_code, course);
    }
    course.sections.push(toSection(dto));
  }
  for (const course of byCode.values()) {
    course.sections.sort((a, b) => a.sectionNumber.localeCompare(b.sectionNumber));
  }
  return [...byCode.values()];
}

export function toSeatAvailability(dto: z.infer<typeof sduAvailability>): SeatAvailability[] {
  return dto.sections.map((s) => ({
    sectionId: s.section_id,
    availableSeats: s.available_seats,
    totalCapacity: s.total_capacity,
    waitlistCount: s.waitlist_count,
  }));
}

export function toBatchSubmitResult(dto: z.infer<typeof sduBatchSubmitResponse>): BatchSubmitResult {
  return {
    transactionId: dto.transaction_id,
    committed: dto.status === "COMMITTED",
    results: dto.results.map((r) => ({
      sectionId: r.section_id,
      outcome: r.status,
      reasonCode: r.reason_code,
      message: r.message,
    })),
  };
}
