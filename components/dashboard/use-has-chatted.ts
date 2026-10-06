"use client";

import { useCallback, useEffect, useState } from "react";

const KEY = "sdu:chatted";
const SYNC = "sdu:chatted-sync";

/**
 * Whether the student has talked to the AI assistant this session. Shared
 * across components (the chat lives in the layout, the recommendations panel in
 * the page) via sessionStorage + a custom event, so AI-derived surfaces like the
 * "AI picks" block only appear once the student has actually asked the assistant.
 */
export function useHasChatted(): readonly [boolean, () => void] {
  const [chatted, setChatted] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setChatted(sessionStorage.getItem(KEY) === "1");
      } catch {
        // sessionStorage unavailable — treat as not chatted
      }
    };
    read();
    window.addEventListener(SYNC, read);
    return () => window.removeEventListener(SYNC, read);
  }, []);

  const markChatted = useCallback(() => {
    setChatted(true);
    try {
      sessionStorage.setItem(KEY, "1");
      window.dispatchEvent(new CustomEvent(SYNC));
    } catch {
      // non-fatal: still set for this component
    }
  }, []);

  return [chatted, markChatted] as const;
}
