/**
 * Builds a compact, grounded context string about the signed-in student for
 * the AI assistant. Best-effort: if the live SDU session has expired we still
 * return whatever is known, rather than failing the chat.
 */
import { getSisClient } from "@/lib/auth/sis-store";
import { getSduApi } from "@/services/sduApi";
import { getEnv } from "@/lib/env";

export async function buildStudentContext(studentId: string): Promise<string> {
  const sis = getSisClient(studentId);
  const lines: string[] = [];

  try {
    if (sis) {
      const [profile, transcript, curriculum] = await Promise.all([
        sis.getProfile(),
        sis.getTranscript(),
        sis.getCurriculum().catch(() => []),
      ]);
      lines.push(`Student: ${profile.fullName} (${profile.studentId}), program: ${profile.program.name}.`);
      lines.push(`GPA: ${profile.gpa.toFixed(2)}/4.00, completed ${profile.completedCredits} ECTS, study year ${profile.studyYear}.`);
      if (profile.advisor) lines.push(`Advisor: ${profile.advisor.fullName}.`);

      const passed = transcript.entries.filter((e) => e.status === "PASSED" || e.status === "TRANSFERRED");
      const inProgress = transcript.entries.filter((e) => e.status === "IN_PROGRESS");
      const failed = transcript.entries.filter((e) => e.status === "FAILED");
      lines.push(`Passed courses (${passed.length}): ${passed.map((e) => `${e.courseCode} (${e.letterGrade})`).join(", ")}.`);
      if (inProgress.length) lines.push(`In progress: ${inProgress.map((e) => e.courseCode).join(", ")}.`);
      if (failed.length) lines.push(`Failed / to retake: ${failed.map((e) => e.courseCode).join(", ")}.`);

      const available = curriculum.filter((c) => c.standing === "available");
      if (available.length) {
        lines.push(`Courses available to take now: ${available.map((c) => `${c.code} ${c.title}`).join("; ")}.`);
      }
    } else {
      // Demo / mock mode.
      const sdu = getSduApi();
      const term = getEnv().SDU_CURRENT_TERM;
      const [profile, transcript, courses] = await Promise.all([
        sdu.getStudentProfile(studentId),
        sdu.getTranscript(studentId),
        sdu.getCatalog(term),
      ]);
      lines.push(`Student: ${profile.fullName} (${profile.studentId}), program: ${profile.program.name}, GPA ${profile.gpa.toFixed(2)}.`);
      const passed = transcript.entries.filter((e) => e.status === "PASSED");
      lines.push(`Passed: ${passed.map((e) => e.courseCode).join(", ")}.`);
      lines.push(
        `This term's catalogue (code — title — ECTS): ${courses
          .slice(0, 40)
          .map((c) => `${c.code} — ${c.title} — ${c.credits}`)
          .join("; ")}.`,
      );
    }
  } catch {
    lines.push("(The student's live SDU data could not be loaded right now.)");
  }

  return lines.join("\n");
}

export const ASSISTANT_SYSTEM = `You are the SDU Course Registration Assistant for Suleyman Demirel University.
Help the student understand their degree progress, which courses they still need, prerequisites,
scheduling and registration questions. Be concise, friendly and practical. Answer in the language
the student writes in (Kazakh, Russian or English). Use ECTS credits. When you are unsure about a
specific rule or exact seat/section data, say so and suggest checking the SIS portal or their advisor —
do not invent facts. Ground every answer in the STUDENT CONTEXT provided.`;
