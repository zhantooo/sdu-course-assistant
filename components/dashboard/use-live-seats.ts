"use client";

import { useEffect, useRef, useState } from "react";
import type { SeatAvailability } from "@/lib/domain/types";

export type SeatSyncStatus = "live" | "error";

export interface SeatChange {
  sectionId: string;
  previous: SeatAvailability | undefined;
  next: SeatAvailability;
}

/**
 * Polls /api/sections/availability and merges live seat counts.
 * Pauses while the tab is hidden and refreshes immediately when it returns.
 * (Swap for SSE/WebSocket once SDU exposes a push channel.)
 */
export function useLiveSeats(
  initial: Record<string, SeatAvailability>,
  options: { intervalMs?: number; enabled?: boolean; onChange?: (changes: SeatChange[]) => void } = {},
) {
  const intervalMs = options.intervalMs ?? 10_000;
  const enabled = options.enabled ?? true;
  const [seats, setSeats] = useState(initial);
  const [status, setStatus] = useState<SeatSyncStatus>("live");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [flashIds, setFlashIds] = useState<ReadonlySet<string>>(new Set());

  const seatsRef = useRef(seats);
  const onChangeRef = useRef(options.onChange);
  useEffect(() => {
    onChangeRef.current = options.onChange;
  });

  useEffect(() => {
    if (!enabled) return; // nothing to poll (e.g. real SDU mode has no mock seat feed yet)
    let cancelled = false;
    let inFlight = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let flashTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    const schedule = () => {
      clearTimeout(timer);
      if (!cancelled) timer = setTimeout(tick, intervalMs);
    };

    async function tick() {
      if (inFlight || cancelled) return;
      if (document.hidden) return schedule();
      inFlight = true;
      try {
        const response = await fetch("/api/sections/availability", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { sections: SeatAvailability[] };

        const previous = seatsRef.current;
        const next = { ...previous };
        const changes: SeatChange[] = [];
        for (const s of data.sections) {
          const before = previous[s.sectionId];
          if (
            !before ||
            before.availableSeats !== s.availableSeats ||
            before.totalCapacity !== s.totalCapacity ||
            before.waitlistCount !== s.waitlistCount
          ) {
            changes.push({ sectionId: s.sectionId, previous: before, next: s });
          }
          next[s.sectionId] = s;
        }

        if (!cancelled && changes.length > 0) {
          seatsRef.current = next;
          setSeats(next);
          setFlashIds(new Set(changes.map((c) => c.sectionId)));
          clearTimeout(flashTimer);
          flashTimer = setTimeout(() => setFlashIds(new Set()), 1500);
          onChangeRef.current?.(changes);
        }
        if (!cancelled) {
          setStatus("live");
          setUpdatedAt(Date.now());
        }
      } catch (error) {
        if (!cancelled && (error as Error).name !== "AbortError") setStatus("error");
      } finally {
        inFlight = false;
        schedule();
      }
    }

    const onVisibility = () => {
      if (!document.hidden) {
        clearTimeout(timer);
        void tick();
      }
    };

    setUpdatedAt(Date.now());
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(flashTimer);
      controller.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);

  return { seats, status, updatedAt, flashIds };
}
