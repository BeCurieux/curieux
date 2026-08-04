// The Little Things (brief §11): "Right now…" — under 60 seconds.
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { addLittleThing } from "@/app/actions";

export const dynamic = "force-dynamic";

const CATEGORIES: [string, string][] = [
  ["current_obsession", "they're obsessed with"],
  ["funny_word", "something funny they say"],
  ["favourite_food", "favourite food"],
  ["comfort_object", "comfort object"],
  ["favourite_person", "favourite person"],
  ["bedtime_ritual", "bedtime demand"],
  ["current_song", "the song"],
  ["current_belief", "a funny belief"],
  ["favourite_activity", "favourite activity"],
];

export default async function LittleThingsPage({ params }: { params: { childId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();
  const { data: things } = await db
    .from("little_things")
    .select("*")
    .eq("child_id", params.childId)
    .order("recorded_date", { ascending: false });

  return (
    <div className="py-10">
      <h1 className="text-3xl">Right now&hellip;</h1>
      <p className="mt-2 text-sm text-ink/60">
        The tiny details you&rsquo;d otherwise forget. One line is enough.
      </p>

      <form action={addLittleThing} className="card mt-8 flex flex-wrap items-end gap-3">
        <input type="hidden" name="child_id" value={params.childId} />
        <div className="min-w-48">
          <label className="label" htmlFor="category">Right now&hellip;</label>
          <select className="input" id="category" name="category">
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="value">is&hellip;</label>
          <input className="input" id="value" name="value" placeholder="strawberries, cut in quarters, no exceptions" />
        </div>
        <button className="btn">Keep it</button>
      </form>

      <ul className="mt-8 grid gap-3 md:grid-cols-2">
        {(things ?? []).map((t) => (
          <li key={t.id} className="card !p-4">
            <div className="text-xs uppercase tracking-wider text-clay">
              {t.category.replace(/_/g, " ")} · {t.recorded_date}
            </div>
            <div className="mt-1 font-display text-lg">{t.value}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
