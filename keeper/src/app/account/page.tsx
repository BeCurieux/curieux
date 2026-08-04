// Account & privacy (brief §4, §27).
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-3xl">Account</h1>
      <div className="card mt-8 text-sm">
        <div className="label">Email</div>
        <p>{user.email}</p>
      </div>
      <div className="card mt-4 text-sm leading-relaxed">
        <h2 className="text-lg">Your family&rsquo;s privacy</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-ink/70">
          <li>Everything you add is private by default. There are no public links to your photos.</li>
          <li>Your family&rsquo;s content is never used to train AI models.</li>
          <li>
            When a book is printed, the printer receives a temporary, expiring link to the final
            file only — nothing else.
          </li>
          <li>
            You can request deletion of your account and every memory, photo and book at any time
            by emailing us. Deletion removes content from storage, not just the app.
          </li>
        </ul>
      </div>
    </div>
  );
}
