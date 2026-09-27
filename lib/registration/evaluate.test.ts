import { describe, expect, it } from "vitest";
import type { Course, Section } from "@/lib/domain/types";
import { evaluateCandidate } from "./evaluate";
import { describeRule, evaluatePrerequisites } from "./prerequisites";

describe("evaluatePrerequisites", () => {
  const passed = new Set(["CSS 242", "MAT 201"]);

  it("satisfies an OR group with any member", () => {
    expect(evaluatePrerequisites([["CSS 242", "CSS 322"]], passed).satisfied).toBe(true);
  });

  it("requires every AND group and reports the missing ones", () => {
    const result = evaluatePrerequisites([["CSS 225"], ["MAT 201"], ["MAT 250", "MAT 260"]], passed);
    expect(result.satisfied).toBe(false);
    expect(result.missing).toEqual([["CSS 225"], ["MAT 250", "MAT 260"]]);
  });

  it("honours advisor waivers", () => {
    expect(evaluatePrerequisites([["CSS 225"]], passed, new Set(["CSS 225"])).satisfied).toBe(true);
  });

  it("describes rules in words", () => {
    expect(describeRule([["CSS 225"], ["MAT 201", "MAT 250"]])).toBe("CSS 225 and (MAT 201 or MAT 250)");
  });
});

const mk = (id: string, code: string, day: "MON" | "TUE", start: number, seats = 10): Section => ({
  id,
  courseCode: code,
  sectionNumber: id.slice(-2),
  instructorName: "Dr. Test",
  totalCapacity: 30,
  availableSeats: seats,
  waitlistCount: 0,
  meetings: [{ day, start, end: start + 110, kind: "LECTURE", classroom: "A" }],
});

const course = (code: string, credits: number, prerequisites: string[][] = []): Course => ({
  code,
  title: code,
  description: "",
  credits,
  departmentCode: code.split(" ")[0],
  level: 300,
  prerequisites,
  sections: [],
});

describe("evaluateCandidate", () => {
  const coursesByCode = new Map(
    [course("CSS 311", 6, [["CSS 225"]]), course("CSS 342", 5), course("CSS 358", 6), course("CSS 410", 5, [["CSS 311"]])].map(
      (c) => [c.code, c],
    ),
  );
  const base = { coursesByCode, passed: new Set(["CSS 225"]), creditLimit: 12 };

  it("blocks missing prerequisites", () => {
    const r = evaluateCandidate(mk("s-410-01", "CSS 410", "MON", 600), { ...base, selected: [] });
    expect(r.blockers.map((b) => b.code)).toEqual(["PREREQUISITES_MISSING"]);
  });

  it("allows reaching the credit limit exactly", () => {
    const selected = [mk("s-311-01", "CSS 311", "TUE", 600)];
    const r = evaluateCandidate(mk("s-358-01", "CSS 358", "MON", 900), { ...base, selected }); // 6 + 6 = 12
    expect(r.blockers).toEqual([]);
  });

  it("blocks going over the credit limit", () => {
    const selected = [mk("s-311-01", "CSS 311", "TUE", 600), mk("s-342-01", "CSS 342", "TUE", 900)];
    const r = evaluateCandidate(mk("s-358-01", "CSS 358", "MON", 900), { ...base, selected }); // 11 + 6 = 17
    expect(r.blockers.map((b) => b.code)).toEqual(["CREDIT_LIMIT"]);
  });

  it("warns (not blocks) on time conflicts", () => {
    const selected = [mk("s-342-01", "CSS 342", "MON", 600)];
    const r = evaluateCandidate(mk("s-311-01", "CSS 311", "MON", 660), { ...base, creditLimit: 30, selected });
    expect(r.blockers).toEqual([]);
    expect(r.warnings.map((w) => w.code)).toEqual(["TIME_CONFLICT"]);
  });

  it("treats another section of a staged course as a swap, not extra credits", () => {
    const selected = [mk("s-311-01", "CSS 311", "TUE", 600), mk("s-342-01", "CSS 342", "MON", 900)];
    const r = evaluateCandidate(mk("s-311-02", "CSS 311", "MON", 600), { ...base, selected });
    expect(r.replaces?.id).toBe("s-311-01");
    expect(r.blockers).toEqual([]); // still 11 credits
  });

  it("blocks full sections and already-passed courses", () => {
    const full = evaluateCandidate(mk("s-342-01", "CSS 342", "MON", 600, 0), { ...base, creditLimit: 30, selected: [] });
    expect(full.blockers.map((b) => b.code)).toEqual(["SECTION_FULL"]);
    const done = evaluateCandidate(mk("s-225-01", "CSS 225", "MON", 600), { ...base, creditLimit: 30, selected: [] });
    expect(done.blockers.map((b) => b.code)).toContain("ALREADY_PASSED");
  });
});
