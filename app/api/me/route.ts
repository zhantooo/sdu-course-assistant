import { NextResponse } from "next/server";
import { withSession } from "@/lib/api/http";
import { getStudentSnapshot } from "@/lib/data/queries";

/** GET /api/me — the signed-in student's profile + transcript (from the DB, else mock). */
export const GET = withSession(async (_request, session) => {
  const { profile, transcript } = await getStudentSnapshot(session.studentId);
  return NextResponse.json({ profile, transcript });
});
