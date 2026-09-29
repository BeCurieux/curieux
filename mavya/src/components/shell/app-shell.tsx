import type { ReactNode } from "react";
import type { Shell } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import { BusinessNav } from "./business-nav";
import { FamilyNav } from "./family-nav";
import { ShellSwitcher } from "./shell-switcher";
import { ShellViewTracker } from "./shell-view-tracker";
import { SignOutButton } from "./sign-out-button";
import { Wordmark } from "./wordmark";

// The frame shared by the three apps.
//
// Family: warm and phone-first, with a bottom tab bar; sign out lives on the
// Account tab. Business: calm and wide, with a short row of sections in the
// header. Instructor: nothing but the class, one-handed on a phone and
// two columns on an iPad.
const TONE: Record<Shell, { page: string; width: string }> = {
  family: {
    page: "bg-[radial-gradient(120%_60%_at_50%_-10%,var(--surface-soft)_0%,var(--bg)_60%)]",
    width: "max-w-lg",
  },
  instructor: { page: "bg-bg", width: "max-w-xl md:max-w-4xl" },
  business: { page: "bg-[#f7f6f9]", width: "max-w-6xl" },
};

export function AppShell({
  shell,
  shells,
  unread = 0,
  children,
}: {
  shell: Shell;
  shells: readonly Shell[];
  // New notifications, shown on the family app's Messages tab.
  unread?: number;
  children: ReactNode;
}) {
  const tone = TONE[shell];
  return (
    <div className={cn("min-h-dvh", tone.page)} data-shell={shell}>
      <ShellViewTracker shell={shell} />
      <header className={cn("mx-auto flex w-full flex-col gap-3 px-5 pt-5 pb-2", tone.width)}>
        <div className="flex items-center justify-between gap-4">
          <Wordmark />
          <div className="flex items-center gap-2">
            <ShellSwitcher current={shell} shells={shells} />
            {shell === "family" ? null : <SignOutButton variant="ghost" />}
          </div>
        </div>
        {shell === "business" ? <BusinessNav /> : null}
      </header>
      <main
        className={cn(
          "mx-auto flex w-full flex-col gap-6 px-5 pt-4",
          shell === "family" ? "pb-32" : "pb-16",
          tone.width,
        )}
      >
        {children}
      </main>
      {shell === "family" ? <FamilyNav unread={unread} /> : null}
    </div>
  );
}
