import { cn } from "@/lib/utils";

interface MeterProps {
  value: number;
  max: number;
  /** Fraction of max at which the bar turns amber. */
  warnAt?: number;
  label: string;
  className?: string;
}

/** Slim progress gauge: ink → amber near the limit → red over it. */
export function Meter({ value, max, warnAt = 0.85, label, className }: MeterProps) {
  const ratio = max > 0 ? value / max : 0;
  const tone = ratio > 1 ? "bg-red-500" : ratio >= warnAt ? "bg-amber-500" : "bg-accent";
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-zinc-100", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", tone)}
        style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }}
      />
    </div>
  );
}
