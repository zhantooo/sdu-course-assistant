"use client";

import { RefreshCw, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-red-50">
        <ServerCrash className="size-5 text-red-500" aria-hidden />
      </div>
      <h1 className="text-base font-semibold text-zinc-900">We couldn&apos;t reach SDU systems</h1>
      <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-500">
        Your profile or the course catalog didn&apos;t load. This is usually temporary during peak registration.
      </p>
      <Button className="mt-5" onClick={reset}>
        <RefreshCw aria-hidden /> Try again
      </Button>
    </div>
  );
}
