import type { Metadata } from "next";
import Link from "next/link";
import { CALCULATORS } from "@/lib/calc";
import { requireUser } from "@/lib/auth/session";
import { loadAccess } from "@/lib/course/queries";
import { reaches, UNLOCKED_BY } from "@/lib/course/tiers";
import { userClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tools" };

const href = (slug: string) => (slug === "product-verdict" ? "/verdict" : `/tools/${slug}`);

// The calculator library. Locked tools show the tier they need; each tool's
// own page checks again on the server.
export default async function ToolsPage() {
  await requireUser("/tools");
  const access = await loadAccess(await userClient());

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
      <p className="text-mute">
        <Link href="/learn">Your course</Link>
      </p>
      <h1 className="mt-3 text-4xl">Tools</h1>
      <p className="mt-3">
        Each one saves your numbers as you go and shows your last run when you come back.
      </p>
      <ul className="divide-line border-line bg-paper mt-8 divide-y rounded-2xl border">
        {CALCULATORS.map((calc) => {
          const open = reaches(access.tier, calc.minTier);
          return (
            <li key={calc.slug}>
              <Link href={href(calc.slug)} className="text-charcoal block px-4 py-4 no-underline">
                <span className="flex items-center gap-2 font-semibold">
                  {open ? null : <span aria-hidden>🔒</span>}
                  {calc.name}
                </span>
                <span className="text-mute block text-base">
                  {open ? calc.description : `Opens with ${UNLOCKED_BY[calc.minTier]}.`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
