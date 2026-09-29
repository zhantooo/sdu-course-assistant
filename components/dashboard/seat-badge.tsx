import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

export type SeatLevel = "open" | "limited" | "full";

export function seatLevel(available: number, total: number): SeatLevel {
  if (available <= 0) return "full";
  if (available <= 5 || available / total <= 0.1) return "limited";
  return "open";
}

interface SeatBadgeProps {
  available: number;
  total: number;
  waitlist: number;
  /** This section is held in the student's plan — show it as a reservation. */
  reserved?: boolean;
  flash?: boolean;
  className?: string;
}

const STYLES: Record<SeatLevel, { dot: string; text: string }> = {
  open: { dot: "bg-accent", text: "text-zinc-600" },
  limited: { dot: "bg-amber-500", text: "text-amber-700" },
  full: { dot: "bg-red-500", text: "text-red-600" },
};

/**
 * Minimal seat indicator. Normally a status dot + count. When `reserved`, the
 * count drops by one (the student's own hold) and it reads "Reserved", so
 * adding a course visibly takes a seat before it is confirmed.
 */
export function SeatBadge({ available, total, waitlist, reserved, flash, className }: SeatBadgeProps) {
  if (reserved) {
    const left = Math.max(0, available - 1);
    return (
      <span
        className={cn(
          "tnum inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent-fg",
          flash && "animate-flash",
          className,
        )}
        title={`You reserved a seat — ${left} of ${total} left`}
      >
        <Bookmark className="size-3" aria-hidden /> Reserved · {left}/{total}
      </span>
    );
  }

  const level = seatLevel(available, total);
  const style = STYLES[level];
  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        style.text,
        flash && "animate-flash",
        className,
      )}
      title={level === "full" ? `Full — ${waitlist} on the waitlist` : `${available} of ${total} seats available`}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
      {level === "full" ? `Full · ${waitlist} waiting` : `${available}/${total} seats`}
    </span>
  );
}
