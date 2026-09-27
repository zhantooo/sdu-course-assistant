"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The student's staged section ids, persisted per student + term in
 * localStorage. Sprint 5 moves this to the StagedSelection table via
 * /api/plan so the plan follows the student across devices.
 */
export function useStagedSections(storageKey: string) {
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setIds(parsed.filter((v): v is string => typeof v === "string"));
    } catch {
      // Storage unavailable (private mode, blocked) — start with an empty plan.
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(ids));
    } catch {
      // Non-fatal: the plan still works for this session.
    }
  }, [ids, hydrated, storageKey]);

  const update = useCallback((updater: (prev: string[]) => string[]) => setIds(updater), []);
  return { stagedIds: ids, setStagedIds: update, hydrated };
}
