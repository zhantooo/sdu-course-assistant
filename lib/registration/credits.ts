import type { StudentProfile } from "@/lib/domain/types";

/**
 * Semester load policy in ECTS credits.
 * PLACEHOLDER VALUES — confirm with the SDU Registrar's academic policy
 * before production; they are centralised here so that is a one-line change.
 */
export const CREDIT_POLICY = {
  standardMax: 30,
  honorsMax: 35,
  honorsMinGpa: 3.33,
  probationMax: 20,
} as const;

export interface CreditLimit {
  max: number;
  reason: string;
}

export function creditLimitFor(profile: Pick<StudentProfile, "gpa" | "academicStatus">): CreditLimit {
  if (profile.academicStatus === "PROBATION") {
    return { max: CREDIT_POLICY.probationMax, reason: "Academic probation limit" };
  }
  if (profile.gpa >= CREDIT_POLICY.honorsMinGpa) {
    return { max: CREDIT_POLICY.honorsMax, reason: `Extended load (GPA ≥ ${CREDIT_POLICY.honorsMinGpa})` };
  }
  return { max: CREDIT_POLICY.standardMax, reason: "Standard semester load" };
}
