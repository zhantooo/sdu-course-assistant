import type { Metadata } from "next";
import { TranscriptView } from "@/components/transcript/transcript-view";
import { requireSession } from "@/lib/auth/session";
import { getStudentSnapshot } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Transcript" };

export default async function TranscriptPage() {
  const session = await requireSession();
  const { profile, transcript } = await getStudentSnapshot(session.studentId);

  return <TranscriptView profile={profile} transcript={transcript} />;
}
