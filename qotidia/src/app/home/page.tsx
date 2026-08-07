import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const db = userClient();
  const { data: children } = await db
    .from("subjects")
    .select("id, display_name, date_of_birth")
    .order("created_at");

  if (!children || children.length === 0) redirect("/onboarding");
  if (children.length === 1) redirect(`/subjects/${children[0].id}`);

  return (
    <div className="py-16">
      <h1 className="text-3xl">Your children</h1>
      <p className="mt-2 text-sm">
        <Link href="/books/new" className="text-ochre hover:underline">
          Make a book from the archive
        </Link>
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {children.map((c) => (
          <Link key={c.id} href={`/subjects/${c.id}`} className="card hover:border-clay">
            <div className="font-display text-2xl">{c.display_name}</div>
            <div className="mt-1 text-sm text-stone">Born {c.date_of_birth}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
