/**
 * Domain model used by the UI and business rules.
 *
 * These types are deliberately decoupled from the SDU wire format
 * (see services/sdu/contracts.ts). When SDU's real payloads differ from the
 * mock contract, only services/sdu/mappers.ts should need to change.
 */

export const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type MeetingKind = "LECTURE" | "PRACTICE" | "LAB";

export interface Meeting {
  day: Weekday;
  /** Minutes since midnight, e.g. 10:00 → 600. */
  start: number;
  /** Exclusive end, minutes since midnight. */
  end: number;
  kind: MeetingKind;
  classroom: string;
}

export interface Section {
  id: string;
  courseCode: string;
  sectionNumber: string;
  instructorName: string;
  totalCapacity: number;
  availableSeats: number;
  waitlistCount: number;
  meetings: Meeting[];
}

/**
 * Prerequisites in conjunctive normal form: every group must be satisfied,
 * and a group is satisfied by passing any one of its course codes.
 * `[["CSS 225"], ["MAT 201", "MAT 250"]]` → CSS 225 AND (MAT 201 OR MAT 250).
 */
export type PrerequisiteRule = string[][];

export interface Course {
  code: string;
  title: string;
  description: string;
  credits: number;
  departmentCode: string;
  level: number;
  prerequisites: PrerequisiteRule;
  sections: Section[];
}

export interface Department {
  code: string;
  name: string;
  faculty: string;
}

export type AcademicStatus = "ACTIVE" | "PROBATION" | "SUSPENDED" | "GRADUATED";

export interface StudentProfile {
  studentId: string;
  fullName: string;
  email: string;
  faculty: string;
  departmentCode: string;
  program: { code: string; name: string };
  studyYear: number;
  gpa: number;
  completedCredits: number;
  requiredCredits: number;
  academicStatus: AcademicStatus;
  advisor: { staffId: string; fullName: string; email: string } | null;
}

export type TranscriptStatus = "PASSED" | "FAILED" | "IN_PROGRESS" | "WITHDRAWN" | "TRANSFERRED";

export interface TranscriptEntry {
  courseCode: string;
  courseTitle: string;
  credits: number;
  termCode: string;
  letterGrade: string | null;
  gradePoints: number | null;
  status: TranscriptStatus;
}

export interface Transcript {
  studentId: string;
  completedCredits: number;
  cumulativeGpa: number;
  entries: TranscriptEntry[];
}

export interface SeatAvailability {
  sectionId: string;
  availableSeats: number;
  totalCapacity: number;
  waitlistCount: number;
}

export type BatchSectionOutcome = "ENROLLED" | "REJECTED";

export interface BatchSubmitResult {
  transactionId: string;
  committed: boolean;
  results: Array<{
    sectionId: string;
    outcome: BatchSectionOutcome;
    reasonCode: string | null;
    message: string;
  }>;
}

export interface WaitlistJoinResult {
  sectionId: string;
  position: number;
  status: "ACTIVE" | "ALREADY_WAITLISTED";
}
