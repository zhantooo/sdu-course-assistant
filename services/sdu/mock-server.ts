/**
 * In-process fake of SDU's backend. It answers the same endpoint keys as the
 * real API with the same wire shapes, so the client's parsing and mapping code
 * runs identically in mock and live mode.
 *
 * State lives on globalThis so it survives Next.js hot reloads in dev.
 */
import { creditLimitFor } from "@/lib/registration/credits";
import { evaluatePrerequisites } from "@/lib/registration/prerequisites";
import { findConflicts } from "@/lib/registration/schedule";
import type { SduSection } from "./contracts";
import type { SduEndpointKey } from "./endpoints";
import {
  buildMockSections,
  buildMockTranscript,
  MOCK_DEPARTMENTS,
  MOCK_STUDENTS,
  MOCK_TERM,
  type MockStudent,
} from "./fixtures";
import { toSection } from "./mappers";

export interface MockRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  headers: Record<string, string>;
}

export interface MockResponse {
  status: number;
  body: unknown;
}

interface MockState {
  sections: Map<string, SduSection>;
  /** Seat counts at boot; drift is pulled back toward these. */
  baseline: Map<string, number>;
  enrollments: Map<string, Set<string>>;
  waitlists: Map<string, string[]>;
  idempotency: Map<string, MockResponse>;
  lastDriftAt: number;
}

const globalForMock = globalThis as unknown as { __sduMockState?: MockState };

function state(): MockState {
  if (!globalForMock.__sduMockState) {
    const sections = buildMockSections();
    globalForMock.__sduMockState = {
      sections: new Map(sections.map((s) => [s.section_id, s])),
      baseline: new Map(sections.map((s) => [s.section_id, s.available_seats])),
      enrollments: new Map(),
      waitlists: new Map(),
      idempotency: new Map(),
      lastDriftAt: Date.now(),
    };
  }
  return globalForMock.__sduMockState;
}

/** Test helper: reset all mutable mock state. */
export function resetMockState(): void {
  delete globalForMock.__sduMockState;
}

const ok = (body: unknown): MockResponse => ({ status: 200, body });
const fail = (status: number, code: string, message: string): MockResponse => ({
  status,
  body: { error: { code, message } },
});

function findStudent(studentId: string): MockStudent | undefined {
  return MOCK_STUDENTS.find((s) => s.profile.student_id === studentId);
}

function profileBody(student: MockStudent) {
  const { gpa, completed } = buildMockTranscript(student);
  return { ...student.profile, current_gpa: gpa, completed_credits: completed };
}

/**
 * Simulates other students registering and dropping: every few seconds a
 * handful of sections gain or lose a seat. Movement is mean-reverting toward
 * the boot baseline, so near-full sections flicker between full and open
 * without the whole catalog draining to zero over a long dev session.
 */
function driftSeats(options: { enabled: boolean; intervalMs?: number }) {
  const s = state();
  const now = Date.now();
  if (!options.enabled || now - s.lastDriftAt < (options.intervalMs ?? 8000)) return;
  s.lastDriftAt = now;

  const sections = [...s.sections.values()];
  for (let i = 0; i < 3; i++) {
    const section = sections[Math.floor(Math.random() * sections.length)];
    const baseline = s.baseline.get(section.section_id) ?? section.available_seats;
    const pDown = section.available_seats > baseline ? 0.7 : section.available_seats < baseline ? 0.3 : 0.5;
    const delta = Math.random() < pDown ? -1 : 1;
    section.available_seats = Math.min(section.total_capacity, Math.max(0, section.available_seats + delta));
  }
}

type Handler = (req: MockRequest, opts: { seatDrift: boolean }) => MockResponse;

const handlers: Record<SduEndpointKey, Handler> = {
  casLogin: () => fail(400, "NOT_AN_API", "casLogin is a browser redirect, not an API call"),
  casLogout: () => fail(400, "NOT_AN_API", "casLogout is a browser redirect, not an API call"),

  casServiceValidate: ({ query }) => {
    const studentId = /^ST-MOCK-(\d+)$/.exec(query.ticket ?? "")?.[1];
    const student = studentId ? findStudent(studentId) : undefined;
    if (!student) {
      return ok({
        serviceResponse: {
          authenticationFailure: { code: "INVALID_TICKET", description: `Ticket ${query.ticket} not recognized` },
        },
      });
    }
    return ok({
      serviceResponse: {
        authenticationSuccess: {
          user: student.profile.student_id,
          attributes: { mail: student.profile.email, displayName: student.profile.full_name },
        },
      },
    });
  },

  studentProfile: ({ params }) => {
    const student = findStudent(params.studentId);
    return student ? ok(profileBody(student)) : fail(404, "STUDENT_NOT_FOUND", `No student ${params.studentId}`);
  },

  studentTranscript: ({ params }) => {
    const student = findStudent(params.studentId);
    if (!student) return fail(404, "STUDENT_NOT_FOUND", `No student ${params.studentId}`);
    const { rows, gpa, completed } = buildMockTranscript(student);
    return ok({
      student_id: student.profile.student_id,
      completed_credits: completed,
      cumulative_gpa: gpa,
      transcript_data: rows,
    });
  },

  departments: () => ok({ departments: MOCK_DEPARTMENTS }),

  termSections: ({ params, query }) => {
    if (params.termCode !== MOCK_TERM.code) {
      return fail(404, "TERM_NOT_FOUND", `No published schedule for ${params.termCode}`);
    }
    // Cursor pagination, so the client's paging loop is exercised in dev.
    const all = [...state().sections.values()];
    const offset = Number(query.cursor ?? 0);
    const limit = Math.min(Number(query.limit ?? 20), 100);
    const page = all.slice(offset, offset + limit);
    const next = offset + limit < all.length ? String(offset + limit) : null;
    return ok({ term_code: params.termCode, sections: page, next_cursor: next });
  },

  sectionAvailability: ({ params, query }, opts) => {
    if (params.termCode !== MOCK_TERM.code) {
      return fail(404, "TERM_NOT_FOUND", `No published schedule for ${params.termCode}`);
    }
    driftSeats({ enabled: opts.seatDrift });
    const wanted = query.ids ? new Set(query.ids.split(",")) : null;
    const sections = [...state().sections.values()]
      .filter((s) => !wanted || wanted.has(s.section_id))
      .map((s) => ({
        section_id: s.section_id,
        available_seats: s.available_seats,
        total_capacity: s.total_capacity,
        waitlist_count: s.waitlist_count,
      }));
    return ok({ as_of: new Date().toISOString(), sections });
  },

  batchSubmit: ({ body, headers }) => {
    const s = state();
    const key = headers["idempotency-key"];
    if (!key) return fail(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
    const replay = s.idempotency.get(key);
    if (replay) return replay;

    const req = body as { student_id: string; term_code: string; section_ids: string[] };
    const student = findStudent(req.student_id);
    if (!student) return fail(404, "STUDENT_NOT_FOUND", `No student ${req.student_id}`);

    const { rows, gpa } = buildMockTranscript(student);
    const passed = new Set(rows.filter((r) => r.status === "PASSED").map((r) => r.course_code));
    const enrolled = s.enrollments.get(req.student_id) ?? new Set<string>();
    const limit = creditLimitFor({ gpa, academicStatus: student.profile.academic_status }).max;

    const reasons = new Map<string, [code: string, message: string]>();
    const alreadyEnrolled = new Set<string>();
    const requested = req.section_ids.map((id) => s.sections.get(id));
    const seenCourses = new Set<string>();

    requested.forEach((section, i) => {
      const id = req.section_ids[i];
      if (!section) return reasons.set(id, ["SECTION_NOT_FOUND", "Section does not exist in this term."]);
      // Re-submitting a section you already hold is an idempotent no-op, not an
      // error. The planner sends the whole plan on every confirm, so earlier
      // enrolments must not fail the atomic batch.
      if (enrolled.has(id)) {
        alreadyEnrolled.add(id);
        seenCourses.add(section.course_code);
        return;
      }
      if (seenCourses.has(section.course_code)) {
        return reasons.set(id, ["DUPLICATE_COURSE", "Only one section per course may be submitted."]);
      }
      seenCourses.add(section.course_code);
      if (section.available_seats <= 0) return reasons.set(id, ["SECTION_FULL", "No seats remaining."]);
      if (!evaluatePrerequisites(section.prerequisites, passed).satisfied) {
        return reasons.set(id, ["PREREQUISITE_MISSING", "Prerequisites not satisfied."]);
      }
    });

    // Only newly-requested sections are enrolled; already-held ones stay as they are.
    const newSections = requested.filter(
      (x, i): x is SduSection => !!x && !alreadyEnrolled.has(req.section_ids[i]) && !reasons.has(req.section_ids[i]),
    );
    const existing = [...enrolled].map((id) => s.sections.get(id)).filter((x): x is SduSection => !!x);
    for (const c of findConflicts([...existing, ...newSections].map(toSection))) {
      for (const id of [c.a.sectionId, c.b.sectionId]) {
        if (req.section_ids.includes(id) && !reasons.has(id) && !alreadyEnrolled.has(id)) {
          reasons.set(id, ["TIME_CONFLICT", `Time conflict with ${c.a.sectionId === id ? c.b.courseCode : c.a.courseCode}.`]);
        }
      }
    }

    const totalCredits = [...existing, ...newSections].reduce((sum, x) => sum + x.credits, 0);
    if (totalCredits > limit) {
      for (const id of req.section_ids) {
        if (!reasons.has(id) && !alreadyEnrolled.has(id)) {
          reasons.set(id, ["CREDIT_LIMIT_EXCEEDED", `Batch exceeds the ${limit}-credit limit.`]);
        }
      }
    }

    const transactionId = `TXN-${Date.now().toString(36).toUpperCase()}`;
    const enrolledRow = (id: string, message: string) =>
      ({ section_id: id, status: "ENROLLED", reason_code: null, message }) as const;
    let response: MockResponse;
    if (reasons.size > 0) {
      response = ok({
        transaction_id: transactionId,
        status: "REJECTED",
        results: req.section_ids.map((id) => {
          if (alreadyEnrolled.has(id)) return enrolledRow(id, "Already enrolled in this section.");
          const [code, message] = reasons.get(id) ?? [
            "BATCH_ABORTED",
            "Not processed: another section in this batch was rejected.",
          ];
          return { section_id: id, status: "REJECTED", reason_code: code, message };
        }),
      });
    } else {
      for (const section of newSections) {
        section.available_seats -= 1;
        // A real enrolment is permanent; keep drift from "refilling" the seat.
        s.baseline.set(section.section_id, (s.baseline.get(section.section_id) ?? 1) - 1);
        enrolled.add(section.section_id);
      }
      s.enrollments.set(req.student_id, enrolled);
      response = ok({
        transaction_id: transactionId,
        status: "COMMITTED",
        results: req.section_ids.map((id) =>
          enrolledRow(id, alreadyEnrolled.has(id) ? "Already enrolled in this section." : "Enrolled."),
        ),
      });
    }
    s.idempotency.set(key, response);
    return response;
  },

  waitlistJoin: ({ params, body }) => {
    const s = state();
    const section = s.sections.get(params.sectionId);
    if (!section) return fail(404, "SECTION_NOT_FOUND", `No section ${params.sectionId}`);
    if (section.available_seats > 0) return fail(409, "SECTION_HAS_SEATS", "Section has open seats; register instead.");

    const studentId = (body as { student_id: string }).student_id;
    const queue = s.waitlists.get(section.section_id) ?? [];
    const existing = queue.indexOf(studentId);
    if (existing >= 0) {
      return ok({ section_id: section.section_id, position: section.waitlist_count - queue.length + existing + 1, status: "ALREADY_WAITLISTED" });
    }
    queue.push(studentId);
    s.waitlists.set(section.section_id, queue);
    section.waitlist_count += 1;
    return ok({ section_id: section.section_id, position: section.waitlist_count, status: "ACTIVE" });
  },
};

export function handleMockRequest(
  endpoint: SduEndpointKey,
  req: MockRequest,
  opts: { seatDrift: boolean },
): MockResponse {
  return handlers[endpoint](req, opts);
}
