import Link from "next/link";
import { SHELL_PATHS, type Shell } from "@/lib/auth/roles";

const LABELS: Record<Shell, string> = {
  business: "Business",
  instructor: "Teaching",
  family: "Family",
};

// Only rendered for people with more than one role, and only links to
// shells they hold.
export function ShellSwitcher({ current, shells }: { current: Shell; shells: readonly Shell[] }) {
  if (shells.length < 2) return null;
  return (
    <nav aria-label="Switch view" className="flex gap-1 rounded-full bg-surface-soft p-1">
      {shells.map((shell) => (
        <Link
          key={shell}
          href={SHELL_PATHS[shell]}
          aria-current={shell === current ? "page" : undefined}
          className="flex h-10 items-center rounded-full px-4 text-sm font-semibold text-muted aria-[current=page]:bg-surface aria-[current=page]:text-ink"
        >
          {LABELS[shell]}
        </Link>
      ))}
    </nav>
  );
}
