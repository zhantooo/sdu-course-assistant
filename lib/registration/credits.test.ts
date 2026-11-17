import { describe, expect, it } from "vitest";
import type { AcademicStatus } from "@/lib/domain/types";
import { assessLoad, creditLimitFor, CREDIT_POLICY } from "./credits";

const profile = (gpa: number, academicStatus: AcademicStatus = "ACTIVE") => ({ gpa, academicStatus });

describe("creditLimitFor", () => {
  it("caps a student on probation to the probation limit with a lighter target", () => {
    const limit = creditLimitFor(profile(3.5, "PROBATION"));
    expect(limit.max).toBe(CREDIT_POLICY.probationMax);
    expect(limit.recommended).toBeLessThan(limit.max);
  });

  it("extends the cap to 45 for a GPA at or above 3.0", () => {
    const limit = creditLimitFor(profile(3.2));
    expect(limit.max).toBe(CREDIT_POLICY.honorsMax);
    expect(limit.recommended).toBe(CREDIT_POLICY.standardMax);
  });

  it("advises a lighter target for a low GPA while keeping the standard 40 cap", () => {
    const limit = creditLimitFor(profile(2.0));
    expect(limit.max).toBe(CREDIT_POLICY.standardMax);
    expect(limit.recommended).toBeLessThan(limit.max);
  });

  it("recommends a full standard load for a mid GPA (2.5–3.0)", () => {
    const limit = creditLimitFor(profile(2.8));
    expect(limit.max).toBe(CREDIT_POLICY.standardMax);
    expect(limit.recommended).toBe(CREDIT_POLICY.standardMax);
  });
});

describe("assessLoad", () => {
  const limit = creditLimitFor(profile(2.8)); // max 40, recommended 40

  it("flags a load over the hard cap", () => {
    expect(assessLoad(44, limit).level).toBe("over");
  });

  it("flags a heavy load above the advised target but within the cap", () => {
    const probation = creditLimitFor(profile(3.5, "PROBATION")); // max 30, recommended 20
    expect(assessLoad(25, probation).level).toBe("heavy");
  });

  it("calls a load near the target balanced", () => {
    expect(assessLoad(36, limit).level).toBe("balanced");
  });

  it("calls a small load light", () => {
    expect(assessLoad(20, limit).level).toBe("light");
  });

  it("treats an empty plan as empty", () => {
    expect(assessLoad(0, limit).level).toBe("empty");
  });
});
