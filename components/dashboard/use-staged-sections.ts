"use client";

import { useCallback, useEffect, useState } from "react";

const SYNC_EVENT = "sdu:plan-sync";

/**
 * The student's staged section ids, persisted per student + term in
 * localStorage. Sprint 5 moves this to the StagedSelection table via
 * /api/plan so the plan follows the student across devices.
 *
 * All hook instances sharing a key stay in sync: a write broadcasts a custom
 * event (same document) and relies on the native `storage` event (other tabs),
 * so the AI assistant can add a course and the planner reflects it at once.
 */
export function useStagedSections(storageKey: string) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const read = useCallback((): string[] => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch {
      // Storage unavailable (private mode, blocked) — start with an empty plan.
      return [];
    }
  }, [storageKey]);

  // Hydrate from storage on mount / key change.
  useEffect(() => {
    setIds(read());
    setHydrated(true);
  }, [read]);

  // Persist and broadcast on change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(ids));
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: storageKey }));
    } catch {
      // Non-fatal: the plan still works for this session.
    }
  }, [ids, hydrated, storageKey]);

  // Re-read when another hook instance (or tab) changes the same key.
  useEffect(() => {
    const resync = () =>
      setIds((prev) => {
        const next = read();
        return prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next;
      });
    const onCustom = (e: Event) => {
      if ((e as CustomEvent).detail === storageKey) resync();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) resync();
    };
    window.addEventListener(SYNC_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, [read, storageKey]);

  const update = useCallback((updater: (prev: string[]) => string[]) => setIds(updater), []);
  return { stagedIds: ids, setStagedIds: update, hydrated };
}
