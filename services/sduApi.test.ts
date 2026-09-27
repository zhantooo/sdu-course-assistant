import { beforeEach, describe, expect, it } from "vitest";
import { resetMockState } from "./sdu/mock-server";
import { MockSduTransport, SduApiClient, SduApiError, type SduRequest, type SduResponse, type SduTransport } from "./sduApi";

const TERM = "2026-FALL";
const newClient = () => new SduApiClient(new MockSduTransport({ latencyMs: 0, seatDrift: false }));

beforeEach(() => resetMockState());

describe("SduApiClient (mock transport)", () => {
  it("round-trips CAS login through ticket validation", async () => {
    const sdu = newClient();
    const service = "http://localhost:3000/api/auth/callback";
    const ticket = new URL(sdu.buildLoginUrl(service, { mockStudentId: "230107021" })).searchParams.get("ticket")!;
    await expect(sdu.validateServiceTicket(ticket, service)).resolves.toEqual({ studentId: "230107021" });
    await expect(sdu.validateServiceTicket("ST-MOCK-999", service)).rejects.toMatchObject({ code: "INVALID_TICKET" });
  });

  it("maps profile and transcript, with GPA computed from grades", async () => {
    const sdu = newClient();
    const [profile, transcript] = await Promise.all([sdu.getStudentProfile("230107021"), sdu.getTranscript("230107021")]);
    expect(profile.program.name).toBe("Computer Science (BSc)");
    expect(profile.gpa).toBe(transcript.cumulativeGpa);
    expect(transcript.entries.find((e) => e.courseCode === "CSS 322")?.status).toBe("FAILED");
    // Failed courses carry no earned credits.
    const earned = transcript.entries.filter((e) => e.status === "PASSED").reduce((n, e) => n + e.credits, 0);
    expect(transcript.completedCredits).toBe(earned);
  });

  it("surfaces SDU error bodies as SduApiError", async () => {
    await expect(newClient().getStudentProfile("000")).rejects.toMatchObject({
      name: "SduApiError",
      status: 404,
      code: "STUDENT_NOT_FOUND",
    });
  });

  it("groups catalog sections by course", async () => {
    const courses = await newClient().getCatalog(TERM);
    const dsa = courses.find((c) => c.code === "CSS 225")!;
    expect(dsa.sections.map((s) => s.sectionNumber)).toEqual(["01", "02"]);
    expect(dsa.prerequisites).toEqual([["CSS 106"], ["MAT 151"]]);
    expect(dsa.sections[0].meetings[0]).toMatchObject({ day: "TUE", start: 600, end: 710 });
  });

  it("batch-submit is all-or-nothing", async () => {
    const sdu = newClient();
    const seatsOf = async (id: string) => (await sdu.getSeatAvailability(TERM, [id]))[0].availableSeats;

    // CSS 311 §02 is full → the whole batch is rejected and nothing is consumed.
    const before = await seatsOf("F26-CSS342-01");
    const rejected = await sdu.batchSubmit({
      studentId: "230107021",
      termCode: TERM,
      sectionIds: ["F26-CSS342-01", "F26-CSS311-02"],
      idempotencyKey: "k1",
    });
    expect(rejected.committed).toBe(false);
    expect(rejected.results.map((r) => r.reasonCode)).toEqual(["BATCH_ABORTED", "SECTION_FULL"]);
    expect(await seatsOf("F26-CSS342-01")).toBe(before);

    const committed = await sdu.batchSubmit({
      studentId: "230107021",
      termCode: TERM,
      sectionIds: ["F26-CSS342-01", "F26-CSS311-01"],
      idempotencyKey: "k2",
    });
    expect(committed.committed).toBe(true);
    expect(await seatsOf("F26-CSS342-01")).toBe(before - 1);

    // Replaying the same idempotency key must not enrol twice.
    const replay = await sdu.batchSubmit({
      studentId: "230107021",
      termCode: TERM,
      sectionIds: ["F26-CSS342-01", "F26-CSS311-01"],
      idempotencyKey: "k2",
    });
    expect(replay.transactionId).toBe(committed.transactionId);
    expect(await seatsOf("F26-CSS342-01")).toBe(before - 1);
  });

  it("rejects time conflicts and missing prerequisites server-side", async () => {
    const result = await newClient().batchSubmit({
      studentId: "230107021",
      termCode: TERM,
      // CSS 342 (Mon 14–15:50) vs CSS 358 §01 (Mon 15–16:50); CSS 410 needs CSS 311 + CSS 342.
      sectionIds: ["F26-CSS342-01", "F26-CSS358-01", "F26-CSS410-01"],
      idempotencyKey: "k3",
    });
    expect(result.committed).toBe(false);
    expect(result.results.map((r) => r.reasonCode)).toEqual(["TIME_CONFLICT", "TIME_CONFLICT", "PREREQUISITE_MISSING"]);
  });
});

describe("SduApiClient contract enforcement", () => {
  class FakeTransport implements SduTransport {
    readonly mode = "live" as const;
    calls: SduRequest[] = [];
    constructor(private readonly respond: (req: SduRequest) => SduResponse) {}
    async send(req: SduRequest) {
      this.calls.push(req);
      return this.respond(req);
    }
  }

  it("follows cursor pagination until next_cursor is null", async () => {
    const page = (cursor: string | null) => ({ term_code: TERM, sections: [], next_cursor: cursor });
    const transport = new FakeTransport((req) => ({
      status: 200,
      body: req.query?.cursor === undefined ? page("p2") : req.query.cursor === "p2" ? page("p3") : page(null),
    }));
    await new SduApiClient(transport).getCatalog(TERM);
    expect(transport.calls.map((c) => c.query?.cursor)).toEqual([undefined, "p2", "p3"]);
  });

  it("fails loudly when a payload drifts from the contract", async () => {
    const transport = new FakeTransport(() => ({ status: 200, body: { student_id: "1", full_name: "X" } }));
    const error = await new SduApiClient(transport).getStudentProfile("1").catch((e) => e);
    expect(error).toBeInstanceOf(SduApiError);
    expect(error.code).toBe("CONTRACT_VIOLATION");
    expect(error.status).toBe(502);
  });
});
