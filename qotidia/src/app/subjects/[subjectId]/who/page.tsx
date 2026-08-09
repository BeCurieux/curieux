// Who's who.
//
// One question at a time, and usually none. This is where a family tells the
// archive that Margaret and Maggie are one grandmother — the only way that
// fact can ever be known, because the alternative is a product deciding
// something about a family it was not told.
//
// The page is built to be finishable. A list of forty "are these the same?"
// rows is data entry, and data entry gets answered carelessly or not at all;
// a single question with the evidence beside it gets answered truthfully.
// When there is nothing to ask, the page says so and looks finished rather
// than empty — which is the common state and the one worth getting right.

import { redirect } from "next/navigation";
import Link from "next/link";
import { currentUser, userClient } from "@/lib/supabase/server";
import { loadEntities } from "@/lib/graph/extract";
import { askAbout, oneToAsk } from "@/lib/graph/identity";
import { loadFamilyResolutions, settledFor } from "@/lib/graph/identity-store";
import { resolveIdentity } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function WhoPage({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: subject } = await db
    .from("subjects")
    .select("id, family_id, display_name")
    .eq("id", params.subjectId)
    .maybeSingle();
  if (!subject?.family_id) redirect("/home");

  const entities = await loadEntities(db, params.subjectId);
  const settled = await settledFor(db, subject.family_id);
  const pair = oneToAsk({ entities, settled });
  const resolved = await loadFamilyResolutions(db, subject.family_id);
  // People only, for the manual picker. Merging two places or two tags is a
  // real thing to want and a much rarer one, and a select box holding every
  // noun in the archive is not a control anybody uses.
  const people = entities.filter((e) => e.kind === "person");

  return (
    <div className="py-12">
      <h1 className="text-title font-display lowercase">who&rsquo;s who</h1>
      <p className="mt-5 max-w-[52ch] leading-relaxed text-stone">
        Families call the same person more than one thing, and the archive has
        no way of knowing. When two names look like they might belong to one
        person, we ask &mdash; and we only ask once.
      </p>

      {pair ? (
        <section className="panel mt-10 md:!p-10">
          <p className="text-sm uppercase tracking-[0.2em] text-clay">A question</p>
          <p className="mt-5 max-w-[46ch] text-subhead leading-snug">{askAbout(pair)}</p>

          {pair.sharedMemoryIds.length > 0 && (
            <p className="mt-4 text-sm text-stone">
              {pair.sharedMemoryIds.length === 1
                ? "One memory has both names on it."
                : `${pair.sharedMemoryIds.length} memories have both names on them.`}
            </p>
          )}

          <form action={resolveIdentity} className="mt-8">
            <input type="hidden" name="subject_id" value={subject.id} />
            <input type="hidden" name="family_id" value={subject.family_id} />
            <input type="hidden" name="key_a" value={pair.a} />
            <input type="hidden" name="key_b" value={pair.b} />
            <input type="hidden" name="label_a" value={pair.labelA} />
            <input type="hidden" name="label_b" value={pair.labelB} />
            <input type="hidden" name="kind" value={pair.kind} />

            {/* Their choice of name, not a majority vote. The one they use
                more is offered first because it is the likelier answer, and
                the other is right there because it is often the better one —
                what a two-year-old calls somebody is frequently the version
                worth keeping. */}
            <fieldset className="rounded-2xl bg-paper/70 p-5">
              <legend className="px-1 text-sm text-stone">If they are, what should we call them?</legend>
              <div className="mt-2 flex flex-wrap gap-5">
                {[pair.labelA, pair.labelB].map((label, i) => (
                  <label key={label} className="flex items-center gap-2.5">
                    <input type="radio" name="keep" value={label} defaultChecked={i === 0} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-7 flex flex-wrap gap-3">
              <button name="answer" value="same" className="btn !px-7">
                Yes, the same
              </button>
              <button name="answer" value="different" className="btn-secondary !px-7">
                No, different
              </button>
            </div>
          </form>

          <p className="mt-7 max-w-[50ch] text-sm leading-relaxed text-stone">
            Either answer settles it. Saying they&rsquo;re the same keeps both
            names &mdash; nothing you&rsquo;ve written is renamed or thrown
            away.
          </p>
        </section>
      ) : (
        <section className="panel mt-10 md:!p-10">
          <p className="text-subhead">Nothing to ask.</p>
          <p className="mt-4 max-w-[48ch] leading-relaxed text-stone">
            Everyone in {subject.display_name}&rsquo;s year is accounted for.
            If that changes as more is added, this is where we&rsquo;ll ask.
          </p>
        </section>
      )}

      {/* The other half, and the more important one.
          The engine only asks when two names genuinely resemble each other.
          Margaret and Maggie share "Ma" and nothing else — that Maggie is
          short for Margaret is world knowledge, not string similarity, and a
          product guessing it from two letters would guess a hundred other
          things wrongly. So it does not guess, and this is where the family
          says it outright. Not asking is the honest half of the feature; this
          is the useful half. */}
      {people.length > 1 && (
        <section className="mt-14">
          <h2 className="font-display text-xl lowercase">two of these are the same person</h2>
          <p className="mt-3 max-w-[52ch] leading-relaxed text-stone">
            If we haven&rsquo;t asked and you already know &mdash; a name
            somebody entered twice, or the one only the children use &mdash;
            tell us here.
          </p>
          <form action={resolveIdentity} className="panel mt-6 md:!p-8">
            <input type="hidden" name="subject_id" value={subject.id} />
            <input type="hidden" name="family_id" value={subject.family_id} />
            <input type="hidden" name="answer" value="same" />
            <input type="hidden" name="kind" value="person" />
            <div className="grid gap-5 sm:grid-cols-2">
              {(["a", "b"] as const).map((side, i) => (
                <label key={side} className="block">
                  <span className="label">{i === 0 ? "This one" : "is the same as"}</span>
                  <select className="input" name={`pick_${side}`} defaultValue={people[i]?.id ?? ""}>
                    {people.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label} &middot; {e.mentions.length}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button className="btn mt-7 !px-7">They&rsquo;re the same</button>
          </form>
        </section>
      )}

      {resolved.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-xl lowercase">what you&rsquo;ve told us</h2>
          <ul className="mt-6 space-y-4">
            {resolved.map((r) => (
              <li key={r.id} className="border-t border-rule pt-4">
                <p className="font-display text-lg">{r.label}</p>
                <p className="mt-1 text-sm text-stone">
                  also written as{" "}
                  {r.keys
                    .map((k) => k.split(":").slice(1).join(":"))
                    .join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-14 text-sm">
        <Link href={`/subjects/${subject.id}/noticed`} className="text-ochre underline underline-offset-4">
          What we&rsquo;ve noticed so far
        </Link>
      </p>
    </div>
  );
}
