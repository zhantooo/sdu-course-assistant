import { NextResponse } from "next/server";
import { withSession } from "@/lib/api/http";
import { getSduApi } from "@/services/sduApi";

/** GET /api/me — fresh profile + transcript from SDU for the signed-in student. */
export const GET = withSession(async (_request, session) => {
  const sdu = getSduApi();
  const [profile, transcript] = await Promise.all([
    sdu.getStudentProfile(session.studentId),
    sdu.getTranscript(session.studentId),
  ]);
  return NextResponse.json({ profile, transcript });
});
