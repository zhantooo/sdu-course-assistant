import type { Section } from "@/lib/domain/types";
import { evaluateCandidate, type SelectionContext } from "./evaluate";

/**
 * Smart auto-enroll gate for the waitlist. A seat freeing up is not enough: the
 * section is claimed on the student's behalf only when adding it to their
 * current schedule breaks no rule — an open seat, no time conflict, within the
 * credit limit, and prerequisites met. It reuses the very same rules engine the
 * manual registration flow uses, so the automatic path can never create a plan
 * the student could not have built by hand.
 */
export function canAutoEnroll(section: Section, ctx: SelectionContext): boolean {
  if (section.availableSeats <= 0) return false;
  const result = evaluateCandidate(section, ctx);
  return result.blockers.length === 0 && result.conflicts.length === 0;
}
