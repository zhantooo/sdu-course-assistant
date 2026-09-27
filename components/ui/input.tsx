import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-9.5 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-xs transition-colors placeholder:text-zinc-400 hover:border-zinc-300 focus:border-accent focus-visible:shadow-none",
        className,
      )}
      {...props}
    />
  );
}
