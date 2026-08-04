import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const db = userClient();
  const { data: children } = await db
    .from("children")
    .select("id, first_name, date_of_birth")
    .order("created_at");

  if (!children || children.length === 0) redirect("/onboarding");
  if (children.length === 1) redirect(`/children/${children[0].id}`);

  return (
    <div className="py-16">
      <h1 className="text-3xl">Your children</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {children.map((c) => (
          <Link key={c.id} href={`/children/${c.id}`} className="card hover:border-clay">
            <div className="font-display text-2xl">{c.first_name}</div>
            <div className="mt-1 text-sm text-ink/60">Born {c.date_of_birth}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
