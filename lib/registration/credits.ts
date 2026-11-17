import type { StudentProfile } from "@/lib/domain/types";

/**
 * Semester load policy in ECTS credits.
 * PLACEHOLDER VALUES — confirm with the SDU Registrar's academic policy
 * before production; they are centralised here so that is a one-line change.
 */
export const CREDIT_POLICY = {
  /** SDU's default semester limit. */
  standardMax: 40,
  /** High performers may carry an extended load. */
  honorsMax: 45,
  /** GPA at or above this earns the extended load. */
  honorsMinGpa: 3.0,
  probationMax: 30,
  /** GPA below this (but not on probation) is a soft signal to take a lighter load. */
  cautionGpa: 2.5,
} as const;

export interface CreditLimit {
  /** Hard cap — the registration flow blocks anything above this. */
  max: number;
  reason: string;
  /** Smart advisory target: the load we actually recommend for this student. */
  recommended: number;
  recommendedReason: string;
}

/**
 * The personalised credit policy for a student. Not a single hard number: the
 * cap adapts to academic standing and GPA (probation → lighter, honors →
 * extended), and alongside it we recommend a *target* load that can sit below
 * the cap when a lighter term is the safer choice.
 */
export function creditLimitFor(profile: Pick<StudentProfile, "gpa" | "academicStatus">): CreditLimit {
  if (profile.academicStatus === "PROBATION") {
    return {
      max: CREDIT_POLICY.probationMax,
      reason: "Academic probation limit",
      recommended: 20,
      recommendedReason: "A lighter load is advised while on probation",
    };
  }
  if (profile.gpa >= CREDIT_POLICY.honorsMinGpa) {
    return {
      max: CREDIT_POLICY.honorsMax,
      reason: `Extended load (GPA ≥ ${CREDIT_POLICY.honorsMinGpa})`,
      recommended: CREDIT_POLICY.standardMax,
      recommendedReason: "Your GPA qualifies you for an extended load",
    };
  }
  if (profile.gpa < CREDIT_POLICY.cautionGpa) {
    return {
      max: CREDIT_POLICY.standardMax,
      reason: "Standard semester load",
      recommended: CREDIT_POLICY.standardMax - 10,
      recommendedReason: "A lighter load is recommended so you can study your courses carefully",
    };
  }
  return {
    max: CREDIT_POLICY.standardMax,
    reason: "Standard semester load",
    recommended: CREDIT_POLICY.standardMax,
    recommendedReason: "A standard full load",
  };
}

export type LoadLevel = "empty" | "light" | "balanced" | "heavy" | "over";

export interface LoadAssessment {
  level: LoadLevel;
  message: string;
}

/**
 * Where the staged credits sit against the student's smart policy: not just
 * "under/over the cap", but whether the term is balanced, light or heavier
 * than we advise even while still within the hard cap.
 */
export function assessLoad(credits: number, limit: CreditLimit): LoadAssessment {
  if (credits <= 0) return { level: "empty", message: "No courses staged yet." };
  if (credits > limit.max) {
    return { level: "over", message: `${credits - limit.max} ECTS over your ${limit.max} ECTS limit.` };
  }
  if (credits > limit.recommended) {
    return { level: "heavy", message: `Above the advised ${limit.recommended} ECTS — a heavy term, but allowed.` };
  }
  if (credits <= limit.recommended - 10) {
    return { level: "light", message: `Room for more — advised up to ${limit.recommended} ECTS.` };
  }
  return { level: "balanced", message: "A balanced load for your standing." };
}
