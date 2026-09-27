import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-[background-color,box-shadow,opacity,border-color] duration-150 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-45 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-white shadow-xs hover:bg-accent-hover",
        ink: "bg-zinc-900 text-white shadow-xs hover:bg-zinc-800 active:bg-zinc-950",
        accent: "bg-accent text-white shadow-xs hover:bg-accent-hover",
        outline: "border border-zinc-200 bg-white text-zinc-800 shadow-xs hover:bg-zinc-50 hover:border-zinc-300",
        ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
        danger: "bg-red-600 text-white shadow-xs hover:bg-red-700",
        success: "bg-accent text-white shadow-xs hover:bg-accent-hover",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9.5 px-4 text-sm",
        lg: "h-11 px-5 text-sm",
        icon: "size-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
