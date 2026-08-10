// Account.
//
// This page used to tell people that deleting their archive meant emailing
// us — which was true when it was written and became false the moment a real
// delete button existed. A privacy claim that has quietly gone stale is
// worse than none, because someone reads it and believes it.
//
// So it now says what is true and links to where each thing is actually
// done, rather than describing the product back to itself.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FACTS = [
  "Everything you add is private by default. There are no public links to your photographs — every image is a signed link that expires in minutes.",
  "Your family's content is never used to train AI models, and your photographs are never sent to one at all.",
  "When a book is printed, the printer receives a temporary, expiring link to the final file only — nothing else.",
];

export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto !max-w-lg py-16">
      <h1 className="text-title">Account</h1>

      <div className="card mt-8 text-sm">
        <div className="label">Email</div>
        <p>{user.email}</p>
      </div>

      <div className="card mt-4 text-sm leading-relaxed">
        <h2 className="text-lg">Your family&rsquo;s privacy</h2>
        <ul className="mt-3 space-y-2 text-ink/70">
          {FACTS.map((f) => (
            <li key={f} className="flex gap-2">
              <span className="text-ochre">&mdash;</span>
              {f}
            </li>
          ))}
        </ul>
        <p className="mt-4">
          You can take a copy of everything, see who has looked, and delete the
          whole archive yourself &mdash; no email, no request, no waiting.
        </p>
        <Link href="/settings/privacy" className="btn-secondary mt-4">
          Your archive
        </Link>
      </div>

      <div className="card mt-4 text-sm leading-relaxed">
        <h2 className="text-lg">What we write to you about</h2>
        <p className="mt-2 text-ink/70">
          Four emails a year you&rsquo;re glad of, rather than forty you delete.
        </p>
        <Link href="/settings/notifications" className="btn-secondary mt-4">
          Notification settings
        </Link>
      </div>

      <p className="mt-8 text-center text-sm text-stone">
        <Link href="/privacy" className="text-ochre">
          How we keep your family private
        </Link>
      </p>
    </div>
  );
}
