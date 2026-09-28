import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireShell } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Family" };

const CHIP_COLOURS = ["bg-coral", "bg-mint", "bg-butter", "bg-lilac"];

export default async function FamilyHome() {
  const viewer = await requireShell("family");
  const supabase = await createClient();

  // Row level security limits this to the viewer's own family.
  const { data: children, error } = await supabase
    .from("children")
    .select("id, first_name")
    .eq("active", true)
    .order("date_of_birth");
  if (error) throw error;

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-muted">
          {viewer.families.map((f) => f.displayName).join(" · ")}
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Hi {viewer.name.split(" ")[0] || "there"}
        </h1>
      </div>
      <Card className="flex flex-col gap-4 rounded-lg border-none">
        <h2 className="text-xl font-semibold">Your kids</h2>
        <ul className="flex flex-wrap gap-3">
          {children.map((child, index) => (
            <li
              key={child.id}
              className="flex h-14 items-center gap-3 rounded-full bg-surface-soft pr-5 pl-2 text-lg font-semibold"
            >
              <span
                aria-hidden
                className={`flex size-10 items-center justify-center rounded-full ${CHIP_COLOURS[index % CHIP_COLOURS.length]}`}
              >
                {child.first_name.charAt(0)}
              </span>
              {child.first_name}
            </li>
          ))}
        </ul>
        <p className="text-muted">Their week of activities will live here.</p>
      </Card>
    </>
  );
}
