import type { Metadata } from "next";
import { SduLoginForm } from "@/components/auth/sdu-login-form";
import { getEnv, termLabel } from "@/lib/env";
import { MOCK_STUDENTS } from "@/services/sdu/fixtures";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const env = getEnv();
  const { error } = await searchParams;
  const expired = error === "session_expired";
  const invalid = error === "invalid_credentials";
  const demoStudents =
    env.SDU_API_MODE === "mock"
      ? MOCK_STUDENTS.map((s) => ({ id: s.profile.student_id, name: s.profile.full_name, year: s.profile.study_year }))
      : [];

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="grid size-11 place-items-center rounded-xl bg-zinc-900 font-mono text-base font-bold text-white shadow-sm">
            S
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900">Course Registration</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Suleyman Demirel University · {termLabel(env.SDU_CURRENT_TERM)}
          </p>
        </div>

        {expired && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-[13px] text-amber-700">
            Your SDU session expired. Please sign in again.
          </p>
        )}
        {invalid && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-center text-[13px] text-red-600">
            SDU didn&apos;t recognise that account. Check your student number and password.
          </p>
        )}

        <SduLoginForm demoStudents={demoStudents} />

        <p className="mt-6 text-center text-xs text-zinc-400">
          Your password goes straight to SDU over a secure connection and is never stored.
        </p>
      </div>
    </main>
  );
}
