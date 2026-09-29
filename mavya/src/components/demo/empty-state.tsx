import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-surface-soft text-ink [&_svg]:size-6">
        {icon}
      </div>
      <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="max-w-sm text-muted">{children}</p>
    </div>
  );
}
