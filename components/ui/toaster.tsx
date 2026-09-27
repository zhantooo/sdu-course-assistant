"use client";

import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!rounded-xl !border !border-zinc-200 !shadow-lg !font-sans !text-zinc-900 !bg-white",
          title: "!font-medium !text-[13px]",
          description: "!text-zinc-500 !text-xs",
          success: "[&_[data-icon]]:!text-accent",
          error: "[&_[data-icon]]:!text-red-500",
          warning: "[&_[data-icon]]:!text-amber-500",
          info: "[&_[data-icon]]:!text-accent",
          actionButton: "!bg-zinc-900 !text-white !rounded-md !text-xs !font-medium",
          cancelButton: "!text-zinc-500",
        },
      }}
    />
  );
}
