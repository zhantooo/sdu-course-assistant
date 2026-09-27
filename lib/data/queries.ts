import { cache } from "react";
import { redirect } from "next/navigation";
import { closeSession, getSisClient } from "@/lib/auth/sis-store";
import { isSisSessionExpired } from "@/services/sdu/sis/client";
import { curriculumToCatalog } from "@/services/sdu/sis/map";
import { getSduApi } from "@/services/sduApi";

/** When the live SIS session has ended, drop it and send the student to re-authenticate. */
function onSisError(studentId: string, error: unknown): never {
  if (isSisSessionExpired(error)) {
    closeSession(studentId);
    // Clears the app cookie too, so the proxy sends us cleanly to /login (no loop).
    redirect("/api/auth/expired");
  }
  throw error;
}

/**
 * Request-scoped data loaders for server components. `cache` dedupes calls
 * within a single render (layout + page asking for the same student).
 *
 * When the student signed in through the real SDU SIS, their live session is
 * used and every value below is their genuine data; otherwise the in-process
 * mock backend answers (local development without SDU access).
 */

export const getStudentSnapshot = cache(async (studentId: string) => {
  const sis = getSisClient(studentId);
  if (sis) {
    try {
      const [profile, transcript] = await Promise.all([sis.getProfile(), sis.getTranscript()]);
      return { profile, transcript: { ...transcript, studentId } };
    } catch (error) {
      onSisError(studentId, error);
    }
  }
  const sdu = getSduApi();
  const [profile, transcript] = await Promise.all([sdu.getStudentProfile(studentId), sdu.getTranscript(studentId)]);
  return { profile, transcript };
});

export const getTermCatalog = cache(async (termCode: string, studentId?: string) => {
  const sis = studentId ? getSisClient(studentId) : null;
  if (sis && studentId) {
    try {
      return curriculumToCatalog(await sis.getCurriculum());
    } catch (error) {
      onSisError(studentId, error);
    }
  }
  const sdu = getSduApi();
  const [courses, departments] = await Promise.all([sdu.getCatalog(termCode), sdu.getDepartments()]);
  return { courses, departments };
});
