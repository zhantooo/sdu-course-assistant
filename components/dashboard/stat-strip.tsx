"use client";

import { AlertTriangle, ArrowUpRight, CheckCircle2, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Meter } from "@/components/ui/meter";
import type { StudentProfile } from "@/lib/domain/types";
import { CREDIT_POLICY } from "@/lib/registration/credits";
import type { SelectionSummary } from "@/lib/registration/evaluate";
import { cn } from "@/lib/utils";
import type { SeatSyncStatus } from "./use-live-seats";

interface StatStripProps {
  profile: StudentProfile;
  summary: SelectionSummary;
  seatStatus: SeatSyncStatus;
  seatsUpdatedAt: number | null;
}

function Tile({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-zinc-200 bg-white p-4 shadow-xs", className)}>
      <p className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">{label}</p>
      {children}
    </div>
  );
}

export function StatStrip({ profile, summary, seatStatus, seatsUpdatedAt }: StatStripProps) {
  const progress = profile.completedCredits / profile.requiredCredits;
  const conflicts = summary.conflicts.length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Degree progress">
        <p className="tnum mt-1.5 font-mono text-[22px] font-semibold text-zinc-900">
          {profile.completedCredits}
          <span className="text-sm font-normal text-zinc-400"> / {profile.requiredCredits}</span>
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-zinc-900" style={{ width: `${Math.min(progress, 1) * 100}%` }} />
        </div>
        <Link
          href="/transcript"
          className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900"
        >
          {Math.round(progress * 100)}% · Year {profile.studyYear}
          <ArrowUpRight className="size-3" aria-hidden />
        </Link>
      </Tile>

      <Tile label="Cumulative GPA">
        <p className="tnum mt-1.5 font-mono text-[22px] font-semibold text-zinc-900">
          {profile.gpa.toFixed(2)}
          <span className="text-sm font-normal text-zinc-400"> / 4.00</span>
        </p>
        <p className="mt-2.5 truncate text-xs text-zinc-500">{profile.program.name}</p>
        {profile.gpa >= CREDIT_POLICY.honorsMinGpa && (
          <p className="mt-1 text-xs font-medium text-accent">Extended load eligible</p>
        )}
      </Tile>

      <Tile label="Term load">
        <p className="tnum mt-1.5 font-mono text-[22px] font-semibold">
          <span className={summary.overLimit ? "text-red-600" : "text-zinc-900"}>{summary.credits}</span>
          <span className="text-sm font-normal text-zinc-400"> / {summary.creditLimit}</span>
        </p>
        <Meter className="mt-2.5" value={summary.credits} max={summary.creditLimit} label="Term credit load" />
        <p className="mt-2 text-xs text-zinc-500">
          {summary.creditLimit - summary.credits >= 0
            ? `${summary.creditLimit - summary.credits} ECTS of headroom`
            : `${summary.credits - summary.creditLimit} over the limit`}
        </p>
      </Tile>

      <Tile label="Schedule" className={cn(conflicts > 0 && "border-red-200 bg-red-50/50")}>
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1.5 text-base font-semibold",
            conflicts > 0 ? "text-red-600" : "text-accent",
          )}
        >
          {conflicts > 0 ? <AlertTriangle className="size-4" aria-hidden /> : <CheckCircle2 className="size-4" aria-hidden />}
          {conflicts > 0 ? `${conflicts} ${conflicts === 1 ? "conflict" : "conflicts"}` : "No conflicts"}
        </p>
        <SeatSyncIndicator status={seatStatus} updatedAt={seatsUpdatedAt} />
      </Tile>
    </div>
  );
}

function SeatSyncIndicator({ status, updatedAt }: { status: SeatSyncStatus; updatedAt: number | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (status === "error") {
    return (
      <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
        <WifiOff className="size-3.5" aria-hidden /> Seat feed offline
      </p>
    );
  }
  const seconds = now && updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : null;
  return (
    <p className="mt-2.5 flex items-center gap-1.5 text-xs text-zinc-400">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
        <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
      </span>
      Live{seconds !== null ? ` · ${seconds}s ago` : ""}
    </p>
  );
}
