import type { Metadata } from "next";
import { RegistrationWorkspace } from "@/components/dashboard/registration-workspace";
import { requireSession } from "@/lib/auth/session";
import { getStudentSnapshot, getTermCatalog } from "@/lib/data/queries";
import { getEnv, termLabel } from "@/lib/env";
import { creditLimitFor } from "@/lib/registration/credits";

export const metadata: Metadata = { title: "Planner" };

export default async function DashboardPage() {
  const session = await requireSession();
  const termCode = getEnv().SDU_CURRENT_TERM;

  const [{ profile, transcript }, { courses, departments }] = await Promise.all([
    getStudentSnapshot(session.studentId),
    getTermCatalog(termCode, session.studentId),
  ]);

  return (
    <RegistrationWorkspace
      profile={profile}
      transcript={transcript}
      courses={courses}
      departments={departments}
      term={{ code: termCode, name: termLabel(termCode) }}
      creditLimit={creditLimitFor(profile)}
    />
  );
}
