import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Large tap targets by default: 48px tall, 56px for primary actions.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "lip bg-ink text-white hover:bg-ink/90 [--lip:#000]",
        warm: "lip bg-coral text-ink hover:bg-[#f59a8a] [--lip:#c9604e]",
        cobalt: "lip bg-cobalt text-white hover:bg-[#5575e0] [--lip:#2f4aa8]",
        soft: "bg-surface-soft text-ink transition hover:bg-lilac/40 active:scale-[0.98]",
        ghost: "text-ink transition hover:bg-surface-soft active:scale-[0.98]",
      },
      size: {
        md: "h-12 px-5 text-base",
        lg: "h-14 px-7 text-lg",
        sm: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
