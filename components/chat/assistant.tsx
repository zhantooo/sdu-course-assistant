"use client";

import { Bot, Check, ChevronDown, Loader2, Plus, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStagedSections } from "@/components/dashboard/use-staged-sections";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  text: string;
}

/** A course the assistant named that the student can add straight to their plan. */
interface CatalogCourse {
  code: string; // "CSS 342"
  title: string;
  credits: number;
  sectionIds: string[]; // add targets the first; any match counts as "in plan"
}

const SUGGESTIONS = [
  "What should I take this semester?",
  "Which prerequisites am I missing?",
  "How many credits until I graduate?",
];

const COURSE_CODE = /\b[A-Z]{2,4}\s?\d{3}\b/g;
const norm = (code: string) => code.replace(/\s+/g, "").toUpperCase();

export function Assistant({ studentId, termCode }: { studentId: string; termCode: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Map<string, CatalogCourse>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const { stagedIds, setStagedIds } = useStagedSections(`sdu:plan:${studentId}:${termCode}`);
  const stagedSet = useMemo(() => new Set(stagedIds), [stagedIds]);

  // Load the catalog once the panel opens, so named courses become addable.
  useEffect(() => {
    if (!open || catalog.size > 0) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/courses");
        const data = await res.json().catch(() => ({}));
        if (!alive || !res.ok || !Array.isArray(data.results)) return;
        const map = new Map<string, CatalogCourse>();
        for (const c of data.results as Array<{ code: string; title: string; credits: number; sections?: { id: string }[] }>) {
          const sectionIds = (c.sections ?? []).map((s) => s.id);
          if (sectionIds.length > 0) map.set(norm(c.code), { code: c.code, title: c.title, credits: c.credits, sectionIds });
        }
        setCatalog(map);
      } catch {
        // Catalog unavailable — the chat still works, just without add-cards.
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, catalog.size]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  /** Courses named in a reply that we can actually offer to add (deduped, in order). */
  function pickCourses(text: string): CatalogCourse[] {
    if (catalog.size === 0) return [];
    const seen = new Set<string>();
    const out: CatalogCourse[] = [];
    for (const m of text.match(COURSE_CODE) ?? []) {
      const key = norm(m);
      const course = catalog.get(key);
      if (course && !seen.has(key)) {
        seen.add(key);
        out.push(course);
      }
    }
    return out;
  }

  function addCourse(course: CatalogCourse) {
    const target = course.sectionIds[0];
    if (!target) return;
    setStagedIds((prev) => (prev.includes(target) ? prev : [...prev, target]));
  }

  function toggleCollapsed(index: number) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);
    const next = [...messages, { role: "user" as const, text: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "The assistant is unavailable.");
      } else {
        setMessages((m) => [...m, { role: "assistant", text: data.reply as string }]);
      }
    } catch {
      setError("Couldn't reach the assistant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close assistant" : "Open assistant"}
        onClick={() => setOpen((v) => !v)}
        className="fixed right-5 bottom-5 z-50 grid size-13 place-items-center rounded-full bg-accent text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        {open ? <X className="size-5" /> : <Sparkles className="size-5" />}
      </button>

      {open && (
        <div className="fixed right-5 bottom-22 z-50 flex h-[min(560px,calc(100dvh-8rem))] w-[min(380px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-lg animate-in slide-in-from-bottom-2 fade-in-0 duration-200">
          <header className="flex items-center gap-2.5 border-b border-zinc-100 px-4 py-3">
            <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-accent-fg">
              <Bot className="size-4" />
            </span>
            <div className="leading-tight">
              <p className="text-[13px] font-semibold text-zinc-900">Course Assistant</p>
              <p className="text-[11px] text-zinc-400">Grounded in your SDU record</p>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-[13px] text-zinc-500">
                  Ask me about your degree progress, prerequisites, or what to take next — I&apos;ll suggest courses you
                  can add to your plan in one tap.
                </p>
                <div className="space-y-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="block w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-[13px] text-zinc-700 transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const courses = m.role === "assistant" ? pickCourses(m.text) : [];
              const isCollapsed = collapsed.has(i);
              return (
                <div key={i} className={cn("flex flex-col gap-2", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
                      m.role === "user" ? "bg-accent text-white" : "bg-zinc-100 text-zinc-800",
                    )}
                  >
                    {m.text}
                  </div>

                  {courses.length > 0 && (
                    <div className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-white">
                      <button
                        type="button"
                        onClick={() => toggleCollapsed(i)}
                        aria-expanded={!isCollapsed}
                        className="flex w-full items-center gap-2 bg-accent-soft/40 px-3 py-2 text-left transition-colors hover:bg-accent-soft/60"
                      >
                        <Sparkles className="size-3.5 shrink-0 text-accent" aria-hidden />
                        <span className="text-[12px] font-medium text-zinc-700">AI picks · this semester</span>
                        <span className="tnum ml-auto rounded-full bg-white px-1.5 text-[10px] font-semibold text-zinc-500">
                          {courses.length}
                        </span>
                        <ChevronDown
                          className={cn("size-3.5 shrink-0 text-zinc-400 transition-transform", isCollapsed && "-rotate-90")}
                          aria-hidden
                        />
                      </button>

                      {!isCollapsed && (
                        <ul className="divide-y divide-zinc-100">
                          {courses.map((course) => {
                            const inPlan = course.sectionIds.some((id) => stagedSet.has(id));
                            return (
                              <li key={course.code} className="flex items-center gap-2 px-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="tnum font-mono text-[12px] font-semibold text-zinc-900">
                                      {course.code}
                                    </span>
                                    <span className="tnum text-[10px] text-zinc-400">{course.credits} ECTS</span>
                                  </div>
                                  <p className="truncate text-[11px] text-zinc-500">{course.title}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => addCourse(course)}
                                  disabled={inPlan}
                                  title={inPlan ? `${course.code} is in your plan` : `Add ${course.code} to plan`}
                                  aria-label={inPlan ? `${course.code} in plan` : `Add ${course.code} to plan`}
                                  className={cn(
                                    "grid size-7 shrink-0 place-items-center rounded-lg border transition-colors",
                                    inPlan
                                      ? "border-transparent text-emerald-600"
                                      : "border-zinc-200 text-zinc-500 hover:border-accent/40 hover:text-accent",
                                  )}
                                >
                                  {inPlan ? <Check className="size-4" /> : <Plus className="size-4" />}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-zinc-400">
                  <Loader2 className="size-3.5 animate-spin" /> <span className="text-xs">Thinking…</span>
                </div>
              </div>
            )}

            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-zinc-100 p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything…"
              className="h-9.5 min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 text-sm outline-none placeholder:text-zinc-400 focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Send"
              className="grid size-9.5 shrink-0 place-items-center rounded-lg bg-accent text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
