import { z } from "zod";

/**
 * Wire contracts for SDU's internal APIs (snake_case, as the university
 * services return them). Every response is parsed against these schemas at
 * the boundary, so a contract drift fails loudly in one place instead of
 * leaking `undefined` into the UI.
 *
 * NOTE: these shapes are our integration proposal, not a published SDU spec.
 * Reconcile them with SDU IT's OpenAPI document before switching to live mode.
 */

const clockTime = z.string().regex(/^\d{2}:\d{2}$/, "expected HH:MM");

export const sduWeekday = z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT"]);

// ─── CAS (protocol v3, JSON format) ────────────────────────────────────────

export const casServiceValidateResponse = z.object({
  serviceResponse: z.union([
    z.object({
      authenticationSuccess: z.object({
        user: z.string(),
        attributes: z.record(z.string(), z.unknown()).optional(),
      }),
    }),
    z.object({
      authenticationFailure: z.object({
        code: z.string(),
        description: z.string(),
      }),
    }),
  ]),
});

// ─── Student profile & transcript ──────────────────────────────────────────

export const sduStudentProfile = z.object({
  student_id: z.string(),
  full_name: z.string(),
  email: z.email(),
  faculty: z.string(),
  department_code: z.string(),
  program_code: z.string(),
  program_name: z.string(),
  study_year: z.number().int().min(1).max(6),
  current_gpa: z.number().min(0).max(4),
  completed_credits: z.number().int().nonnegative(),
  required_credits: z.number().int().positive(),
  academic_status: z.enum(["ACTIVE", "PROBATION", "SUSPENDED", "GRADUATED"]),
  advisor: z
    .object({ staff_id: z.string(), full_name: z.string(), email: z.email() })
    .nullable(),
});
export type SduStudentProfile = z.infer<typeof sduStudentProfile>;

export const sduTranscriptRow = z.object({
  course_code: z.string(),
  course_title: z.string(),
  credits: z.number().int().positive(),
  term_code: z.string(),
  letter_grade: z.string().nullable(),
  grade_points: z.number().min(0).max(4).nullable(),
  status: z.enum(["PASSED", "FAILED", "IN_PROGRESS", "WITHDRAWN", "TRANSFERRED"]),
});

export const sduTranscript = z.object({
  student_id: z.string(),
  completed_credits: z.number().int().nonnegative(),
  cumulative_gpa: z.number().min(0).max(4),
  transcript_data: z.array(sduTranscriptRow),
});
export type SduTranscript = z.infer<typeof sduTranscript>;

// ─── Catalog ───────────────────────────────────────────────────────────────

export const sduDepartment = z.object({
  department_code: z.string(),
  name: z.string(),
  faculty: z.string(),
});

export const sduDepartmentList = z.object({ departments: z.array(sduDepartment) });

export const sduTimeSlot = z.object({
  day: sduWeekday,
  start_time: clockTime,
  end_time: clockTime,
  type: z.enum(["LECTURE", "PRACTICE", "LAB"]),
  classroom: z.string(),
});

export const sduSection = z.object({
  section_id: z.string(),
  course_code: z.string(),
  course_title: z.string(),
  course_description: z.string().default(""),
  department_code: z.string(),
  course_level: z.number().int(),
  credits: z.number().int().positive(),
  section_number: z.string(),
  instructor_id: z.string().nullable(),
  instructor_name: z.string(),
  total_capacity: z.number().int().nonnegative(),
  available_seats: z.number().int().nonnegative(),
  waitlist_count: z.number().int().nonnegative(),
  /** Primary room; per-meeting rooms live on each time slot. */
  classroom: z.string(),
  time_slots: z.array(sduTimeSlot),
  /** CNF: outer = AND, inner = OR of course codes. */
  prerequisites: z.array(z.array(z.string())),
});
export type SduSection = z.infer<typeof sduSection>;

export const sduSectionPage = z.object({
  term_code: z.string(),
  sections: z.array(sduSection),
  next_cursor: z.string().nullable(),
});

export const sduAvailability = z.object({
  as_of: z.string(),
  sections: z.array(
    z.object({
      section_id: z.string(),
      available_seats: z.number().int().nonnegative(),
      total_capacity: z.number().int().nonnegative(),
      waitlist_count: z.number().int().nonnegative(),
    }),
  ),
});

// ─── Registration ──────────────────────────────────────────────────────────

export const sduBatchSubmitRequest = z.object({
  student_id: z.string(),
  term_code: z.string(),
  section_ids: z.array(z.string()).min(1),
});
export type SduBatchSubmitRequest = z.infer<typeof sduBatchSubmitRequest>;

export const sduBatchSubmitResponse = z.object({
  transaction_id: z.string(),
  status: z.enum(["COMMITTED", "REJECTED"]),
  results: z.array(
    z.object({
      section_id: z.string(),
      status: z.enum(["ENROLLED", "REJECTED"]),
      reason_code: z.string().nullable(),
      message: z.string(),
    }),
  ),
});

export const sduWaitlistJoinRequest = z.object({ student_id: z.string() });

export const sduWaitlistJoinResponse = z.object({
  section_id: z.string(),
  position: z.number().int().positive(),
  status: z.enum(["ACTIVE", "ALREADY_WAITLISTED"]),
});

// ─── Errors ────────────────────────────────────────────────────────────────

export const sduErrorBody = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
