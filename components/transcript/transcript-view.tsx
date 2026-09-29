"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { StudentProfile, TranscriptEntry, Transcript, TranscriptStatus } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

type StatusTone = "positive" | "danger" | "info";

// Passed / transferred read green, failed / withdrawn read red, in-progress teal.
const STATUS_META: Record<TranscriptStatus, { tone: StatusTone; label: string; dot: string }> = {
  PASSED: { tone: "positive", label: "Passed", dot: "bg-emerald-500" },
  TRANSFERRED: { tone: "positive", label: "Transferred", dot: "bg-emerald-500" },
  IN_PROGRESS: { tone: "info", label: "In progress", dot: "bg-accent" },
  WITHDRAWN: { tone: "danger", label: "Withdrawn", dot: "bg-red-500" },
  FAILED: { tone: "danger", label: "Failed", dot: "bg-red-500" },
};

// Order the status filter chips: earned first, then in-progress, then the flags.
const STATUS_ORDER: TranscriptStatus[] = ["PASSED", "TRANSFERRED", "IN_PROGRESS", "WITHDRAWN", "FAILED"];

type StatusFilter = TranscriptStatus | "ALL";

function termSortKey(code: string) {
  const [year, season] = code.split("-");
  return Number(year) * 10 + ({ SPRING: 1, SUMMER: 2, FALL: 3 }[season] ?? 0);
}

function termLabel(code: string) {
  const [year, season] = code.split("-");
  return `${season.charAt(0)}${season.slice(1).toLowerCase()} ${year}`;
}

const normalize = (v: string) => v.toLowerCase().replace(/\s+/g, "");

export function TranscriptView({ profile, transcript }: { profile: StudentProfile; transcript: Transcript }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  // Stats always reflect the full record, not the filtered view.
  const passedCount = transcript.entries.filter((e) => e.status === "PASSED" || e.status === "TRANSFERRED").length;
  const needsAttention = transcript.entries.filter((e) => e.status === "FAILED" || e.status === "WITHDRAWN").length;
  const progress = transcript.completedCredits / profile.requiredCredits;

  // How many courses carry each status — powers the filter chips (and their counts).
  const statusCounts = useMemo(() => {
    const counts = {} as Record<TranscriptStatus, number>;
    for (const e of transcript.entries) counts[e.status] = (counts[e.status] ?? 0) + 1;
    return counts;
  }, [transcript.entries]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    const entries = transcript.entries.filter((e) => {
      if (status !== "ALL" && e.status !== status) return false;
      if (!q) return true;
      return normalize(e.courseCode).includes(q) || e.courseTitle.toLowerCase().includes(query.toLowerCase());
    });
    const terms = new Map<string, TranscriptEntry[]>();
    for (const entry of entries) terms.set(entry.termCode, [...(terms.get(entry.termCode) ?? []), entry]);
    return [...terms.entries()].sort(([a], [b]) => termSortKey(b) - termSortKey(a));
  }, [transcript.entries, query, status]);

  const matchCount = filtered.reduce((n, [, entries]) => n + entries.length, 0);
  const activeChips = STATUS_ORDER.filter((s) => statusCounts[s] > 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium tracking-wide text-zinc-400 uppercase">Completed course tracker</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-[28px]">{profile.program.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {profile.fullName} · <span className="tnum font-mono">{profile.studentId}</span> · Year {profile.studyYear}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Earned credits" value={`${transcript.completedCredits}`} suffix={`/ ${profile.requiredCredits}`}>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(progress, 1) * 100}%` }} />
          </div>
        </Stat>
        <Stat label="Cumulative GPA" value={transcript.cumulativeGpa.toFixed(2)} suffix="/ 4.00" />
        <Stat label="Courses passed" value={`${passedCount}`} />
        <Stat label="Failed / withdrawn" value={`${needsAttention}`} tone={needsAttention > 0 ? "danger" : undefined} />
      </div>

      <div className="space-y-3">
        <label className="relative block max-w-md">
          <span className="sr-only">Search completed courses</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your completed courses…"
            className="pl-9"
          />
        </label>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter courses by status">
          <StatusChip active={status === "ALL"} onClick={() => setStatus("ALL")} count={transcript.entries.length}>
            All
          </StatusChip>
          {activeChips.map((s) => (
            <StatusChip key={s} active={status === s} onClick={() => setStatus(s)} count={statusCounts[s]} dot={STATUS_META[s].dot}>
              {STATUS_META[s].label}
            </StatusChip>
          ))}
        </div>
      </div>

      {(query || status !== "ALL") && (
        <p className="-mt-3 text-xs text-zinc-400" aria-live="polite">
          <span className="tnum font-medium text-zinc-600">{matchCount}</span> course{matchCount === 1 ? "" : "s"}
          {status !== "ALL" ? ` marked ${STATUS_META[status as TranscriptStatus].label.toLowerCase()}` : ""}
          {query ? ` matching “${query}”` : ""}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-400">
          No courses match the current filters.
        </p>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {filtered.map(([termCode, entries]) => {
            const earned = entries.filter((e) => e.status === "PASSED").reduce((n, e) => n + e.credits, 0);
            return (
              <Card key={termCode}>
                <CardHeader>
                  <CardTitle>{termLabel(termCode)}</CardTitle>
                  <span className="tnum text-xs text-zinc-400">{earned} ECTS earned</span>
                </CardHeader>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] font-medium tracking-wide text-zinc-400 uppercase">
                        <th scope="col" className="px-5 py-2.5">Course</th>
                        <th scope="col" className="px-2 py-2.5 text-right">ECTS</th>
                        <th scope="col" className="px-2 py-2.5 text-center">Grade</th>
                        <th scope="col" className="px-5 py-2.5 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {entries.map((e) => (
                        <tr key={e.courseCode + e.termCode} className="transition-colors hover:bg-zinc-50">
                          <td className="px-5 py-2.5">
                            <span className="tnum font-mono text-xs font-semibold text-zinc-800">{e.courseCode}</span>
                            <span className="block text-xs text-zinc-500">{e.courseTitle}</span>
                          </td>
                          <td className="tnum px-2 py-2.5 text-right font-mono text-xs text-zinc-500">{e.credits}</td>
                          <td className="tnum px-2 py-2.5 text-center font-mono text-sm font-semibold text-zinc-900">
                            {e.letterGrade ?? "—"}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <Badge tone={STATUS_META[e.status].tone}>{STATUS_META[e.status].label}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusChip({
  active,
  onClick,
  count,
  dot,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  dot?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-zinc-900 bg-zinc-900 text-white"
          : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50",
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", active ? "bg-white" : dot)} aria-hidden />}
      {children}
      <span className={cn("tnum font-mono text-[10px]", active ? "text-white/70" : "text-zinc-400")}>{count}</span>
    </button>
  );
}

function Stat({
  label,
  value,
  suffix,
  tone,
  children,
}: {
  label: string;
  value: string;
  suffix?: string;
  tone?: "danger";
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs">
      <p className="text-[11px] font-medium tracking-wide text-zinc-400 uppercase">{label}</p>
      <p className={`tnum mt-1.5 font-mono text-[22px] font-semibold ${tone === "danger" ? "text-red-600" : "text-zinc-900"}`}>
        {value}
        {suffix && <span className="text-sm font-normal text-zinc-400"> {suffix}</span>}
      </p>
      {children}
    </div>
  );
}
