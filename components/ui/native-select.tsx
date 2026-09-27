import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-9 w-full appearance-none rounded-lg border border-zinc-200 bg-white pr-8 pl-3 text-sm text-zinc-800 shadow-xs transition-colors hover:border-zinc-300 focus:border-accent focus-visible:shadow-none",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-zinc-400" />
    </div>
  );
}
