"use client";

import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  "What courses can I take next semester?",
  "Which prerequisites am I missing?",
  "How many credits until I graduate?",
];

export function Assistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

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
                  Ask me about your degree progress, prerequisites, or what to take next.
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

            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap",
                    m.role === "user" ? "bg-accent text-white" : "bg-zinc-100 text-zinc-800",
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

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
