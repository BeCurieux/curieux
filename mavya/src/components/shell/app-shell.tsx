import type { ReactNode } from "react";
import type { Shell } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { ShellSwitcher } from "./shell-switcher";
import { ShellViewTracker } from "./shell-view-tracker";
import { SignOutButton } from "./sign-out-button";
import { Wordmark } from "./wordmark";

// The frame shared by the three apps. The family app is warm and narrow
// (phone first); business and instructor are calmer and wider.
const TONE: Record<Shell, { page: string; width: string }> = {
  family: {
    page: "bg-[linear-gradient(180deg,var(--surface-soft),var(--bg)_320px)]",
    width: "max-w-lg",
  },
  instructor: { page: "bg-bg", width: "max-w-2xl" },
  business: { page: "bg-bg", width: "max-w-5xl" },
};

export function AppShell({
  shell,
  shells,
  children,
}: {
  shell: Shell;
  shells: readonly Shell[];
  children: ReactNode;
}) {
  const tone = TONE[shell];
  return (
    <div className={cn("min-h-dvh", tone.page)} data-shell={shell}>
      <ShellViewTracker shell={shell} />
      <header
        className={cn(
          "mx-auto flex w-full items-center justify-between gap-4 px-5 py-5",
          tone.width,
        )}
      >
        <Wordmark />
        <div className="flex items-center gap-3">
          <ShellSwitcher current={shell} shells={shells} />
          <SignOutButton variant="ghost" />
        </div>
      </header>
      <main className={cn("mx-auto flex w-full flex-col gap-6 px-5 pt-4 pb-16", tone.width)}>
        {children}
      </main>
    </div>
  );
}
