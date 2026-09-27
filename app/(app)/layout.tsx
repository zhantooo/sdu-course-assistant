import { Assistant } from "@/components/chat/assistant";
import { AppHeader } from "@/components/layout/app-header";
import { requireSession } from "@/lib/auth/session";
import { getEnv, termLabel } from "@/lib/env";
import { isGeminiConfigured } from "@/lib/ai/gemini";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const env = getEnv();
  return (
    <>
      <AppHeader
        studentName={session.fullName}
        studentId={session.studentId}
        termName={termLabel(env.SDU_CURRENT_TERM)}
        mockMode={env.SDU_API_MODE === "mock"}
      />
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
      {isGeminiConfigured() && <Assistant />}
    </>
  );
}
