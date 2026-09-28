import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-sm border border-line bg-surface px-4 text-base text-ink placeholder:text-muted focus-visible:border-cobalt aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
