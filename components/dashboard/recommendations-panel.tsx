"use client";

import { Check, Loader2, Plus, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Course } from "@/lib/domain/types";
import { recommendCourses } from "@/lib/recommendation/recommend";
import { cn } from "@/lib/utils";

export interface RecProfile {
  fullName: string;
  program: string;
  gpa: number;
  completedCredits: number;
  requiredCredits: number;
  creditLimit: number;
}

interface RecommendationsPanelProps {
  courses: Course[];
  passed: ReadonlySet<string>;
  failed: ReadonlySet<string>;
  profile: RecProfile;
  stagedCourseCodes: ReadonlySet<string>;
  onAdd?: (course: Course) => void;
}

export function RecommendationsPanel({ courses, passed, failed, profile, stagedCourseCodes, onAdd }: RecommendationsPanelProps) {
  const { eligible } = useMemo(() => recommendCourses(courses, passed, failed), [courses, passed, failed]);
  const top = eligible.slice(0, 8);

  const [summary, setSummary] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  // Re-request only when the actual candidate set changes; keyed so it also
  // survives dev StrictMode's double-mount without aborting the live request.
  const candidateKey = top.map((r) => r.course.code).join(",");
  const requestedFor = useRef("");

  useEffect(() => {
    if (!candidateKey || requestedFor.current === candidateKey) return;
    requestedFor.current = candidateKey;

    // Reuse a cached summary for the same candidate set to avoid re-calling the
    // model (and burning quota) on every visit to the planner.
    try {
      const cached = sessionStorage.getItem(`rec:${candidateKey}`);
      if (cached) {
        setSummary(cached);
        setStatus("ready");
        return;
      }
    } catch {
      // sessionStorage unavailable — just fetch.
    }

    let alive = true;
    setStatus("loading");
    (async () => {
      try {
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profile,
            candidates: top.map((r) => ({
              code: r.course.code,
              title: r.course.title,
              credits: r.course.credits,
              level: r.course.level,
              reasons: r.reasons,
            })),
            recentlyPassed: [...passed].slice(0, 60),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!res.ok) {
          setStatus("error");
        } else {
          setSummary(data.summary as string);
          setStatus("ready");
          try {
            sessionStorage.setItem(`rec:${candidateKey}`, data.summary as string);
          } catch {
            // best-effort cache only
          }
        }
      } catch {
        if (alive) setStatus("error");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateKey]);

  if (top.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" aria-hidden /> Recommended for you
        </CardTitle>
        <span className="text-xs text-zinc-400">{eligible.length} eligible</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-accent-soft/50 p-3.5 text-[13px] leading-relaxed text-zinc-700">
          {status === "loading" && (
            <span className="flex items-center gap-2 text-zinc-500">
              <Loader2 className="size-3.5 animate-spin" /> Analysing your degree plan…
            </span>
          )}
          {status === "error" && <span className="text-zinc-500">Personalised advice is unavailable right now, but the eligible courses below are ranked for you.</span>}
          {status === "ready" && summary && <p className="whitespace-pre-wrap">{summary}</p>}
        </div>

        <ul className="grid gap-2 sm:grid-cols-2">
          {top.map(({ course, reasons, retake }) => {
            const staged = stagedCourseCodes.has(course.code);
            return (
              <li
                key={course.code}
                className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="tnum font-mono text-[13px] font-semibold text-zinc-900">{course.code}</span>
                    <span className="tnum text-[11px] text-zinc-400">{course.credits} ECTS</span>
                    {retake && <Badge tone="warning">Retake</Badge>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-600">{course.title}</p>
                  {reasons[0] && <p className="mt-0.5 text-[11px] text-accent-fg">{reasons[0]}</p>}
                </div>
                {onAdd && course.sections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onAdd(course)}
                    disabled={staged}
                    className={cn(
                      "mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border transition-colors",
                      staged
                        ? "border-transparent text-accent"
                        : "border-zinc-200 text-zinc-500 hover:border-accent/40 hover:text-accent",
                    )}
                    aria-label={staged ? `${course.code} in plan` : `Add ${course.code}`}
                  >
                    {staged ? <Check className="size-4" /> : <Plus className="size-4" />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
