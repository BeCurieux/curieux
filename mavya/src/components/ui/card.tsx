import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface p-6 shadow-[0_1px_0_var(--border)]",
        className,
      )}
      {...props}
    />
  );
}
