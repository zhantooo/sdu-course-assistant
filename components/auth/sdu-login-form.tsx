"use client";

import { ArrowRight, KeyRound, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Step = "credentials" | "verify";

interface ApiResult {
  step: "authenticated" | "verify" | "failed";
  message?: string;
}

export interface DemoStudent {
  id: string;
  name: string;
  year: number;
}

/** Local format checks so the student gets an instant, specific reason. */
function validateCredentials(username: string, password: string): string | null {
  const u = username.trim();
  if (!u) return "Enter your student number.";
  if (!/^\d+$/.test(u)) return "Student number should contain digits only.";
  if (u.length < 6) return "That student number looks too short.";
  if (!password) return "Enter your password.";
  return null;
}

export function SduLoginForm({ demoStudents = [] }: { demoStudents?: DemoStudent[] }) {
  const [step, setStep] = useState<Step>("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: unknown): Promise<ApiResult> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => ({ step: "failed", message: "Unexpected response." }))) as ApiResult;
  }

  function done(result: ApiResult): boolean {
    if (result.step === "authenticated") {
      window.location.assign("/dashboard");
      return true;
    }
    return false;
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    const invalid = validateCredentials(username, password);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await post("/api/auth/sdu/login", { username: username.trim(), password });
      if (done(result)) return;
      if (result.step === "verify") {
        setStep("verify");
        setNote(result.message ?? "A verification code was sent to your SDU email.");
      } else {
        setError(result.message ?? "Sign-in failed.");
      }
    } catch {
      setError("Couldn't reach the server. Is it running?");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) {
      setError("Enter the code from your email.");
      return;
    }
    if (!/^\d{3,8}$/.test(code.trim())) {
      setError("The code should be the digits from your email.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await post("/api/auth/sdu/verify", { code: code.trim() });
      if (done(result)) return;
      setError(result.message ?? "That code was not accepted.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-[15px] font-semibold text-zinc-900">
        {step === "credentials" ? "Sign in with your SDU account" : "Two-factor verification"}
      </h2>
      <p className="mt-1 text-[13px] text-zinc-500">
        {step === "credentials"
          ? "Your real profile, transcript and courses load automatically."
          : note ?? "Enter the code sent to your SDU email."}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-600">
          {error}
        </p>
      )}

      {step === "credentials" ? (
        <form onSubmit={submitCredentials} className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Student number</span>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                inputMode="numeric"
                autoComplete="username"
                placeholder="e.g. 2XXXXXXXX"
                required
                className="pl-9"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Password</span>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
                className="pl-9"
              />
            </div>
          </label>
          <Button type="submit" size="lg" className="mt-1 w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
            {busy ? "Signing in…" : "Continue"}
          </Button>

          {demoStudents.length > 0 && (
            <div className="mt-4 border-t border-zinc-100 pt-4">
              <p className="mb-2 text-xs font-medium text-zinc-400">Just exploring? Try a demo account</p>
              <div className="space-y-1.5">
                {demoStudents.map((s) => (
                  <a
                    key={s.id}
                    href={`/api/auth/login?student_id=${s.id}`}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-[13px] transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                  >
                    <span className="text-zinc-700">
                      {s.name} · Year {s.year}
                    </span>
                    <ArrowRight className="size-3.5 text-zinc-400" aria-hidden />
                  </a>
                ))}
              </div>
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={submitCode} className="mt-5 space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-[13px] text-accent-fg">
            <Mail className="size-4 shrink-0" aria-hidden />
            Check your SDU email for the code.
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">Verification code</span>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              autoFocus
              required
              className="text-center text-lg tracking-[0.3em]"
            />
          </label>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
            {busy ? "Verifying…" : "Verify & sign in"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setError(null);
              setCode("");
            }}
            className="flex w-full items-center justify-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Use a different account <ArrowRight className="size-3" aria-hidden />
          </button>
        </form>
      )}
    </div>
  );
}
