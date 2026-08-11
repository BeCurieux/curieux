// The frame every screen about one child sits in.
//
// There was no layout here, so each of the fifteen screens underneath was an
// island: no name at the top, no way back, and no indication that the other
// fourteen existed. Putting the nav in a layout rather than in each page is
// the whole point — it cannot drift, and a screen added later inherits it
// without anybody remembering to.
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { countStoryMemories } from "@/lib/memories/scope";
import { roleForSubject } from "@/lib/family/membership";
import { canModerate } from "@/lib/family/roles";
import { SubjectNav } from "./nav";

export default async function SubjectLayout(props: {
  children: React.ReactNode;
  params: Promise<{ subjectId: string }>;
}) {
  const params = await props.params;
  const user = await currentUser();
  if (!user) redirect("/login");

  const db = await userClient();
  const { data: subject } = await db
    .from("subjects")
    .select("id, display_name")
    .eq("id", params.subjectId)
    .single();
  if (!subject) redirect("/home");

  // Only a moderator can act on the queue, so only a moderator is told it
  // has anything in it. A count somebody cannot clear is just a nag.
  const role = (await roleForSubject(db, subject.id, user.id))?.role ?? null;
  const waiting = canModerate(role)
    ? await countStoryMemories(db, subject.id, { pendingOnly: true })
    : 0;

  // One element, deliberately. `main` styles its *direct* children with the
  // reading column and a pb-24 — so returning a fragment would hand the
  // back-link and the nav their own six-rem footers. The wrapper takes the
  // column once and everything inside flows normally.
  return (
    <div>
      {/* A way back that names where it goes. "Home" in the header is the
          whole account; this is the one step up from here. */}
      <Link
        href="/home"
        className="mt-8 inline-block text-sm text-stone transition hover:text-clay"
      >
        ← Everyone you keep
      </Link>
      <SubjectNav subjectId={subject.id} waiting={waiting} />
      {props.children}
    </div>
  );
}
