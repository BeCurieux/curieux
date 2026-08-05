// The Little Things (brief §11): under 60 seconds.
// The prompt and the categories come from the subject-type config, so a life
// story asks for a recipe where a child's year asks for a comfort object.
import { redirect } from "next/navigation";
import { currentUser, userClient } from "@/lib/supabase/server";
import { addLittleThing } from "@/app/actions";
import { configFor } from "@/lib/subjects/config";
import type { SubjectType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LittleThingsPage({ params }: { params: { subjectId: string } }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = userClient();

  const { data: subject } = await db
    .from("subjects")
    .select("subject_type")
    .eq("id", params.subjectId)
    .single();
  if (!subject) redirect("/home");

  const config = configFor((subject.subject_type ?? "child") as SubjectType);

  const { data: things } = await db
    .from("little_things")
    .select("*")
    .eq("subject_id", params.subjectId)
    .order("recorded_date", { ascending: false });

  return (
    <div className="py-10">
      <h1 className="text-3xl">{config.littleThingsPrompt}</h1>
      <p className="mt-2 text-sm text-stone">
        The tiny details you&rsquo;d otherwise forget. One line is enough.
      </p>

      <form action={addLittleThing} className="card mt-8 flex flex-wrap items-end gap-3">
        <input type="hidden" name="subject_id" value={params.subjectId} />
        <div className="min-w-48">
          <label className="label" htmlFor="category">{config.littleThingsPrompt}</label>
          <select className="input" id="category" name="category">
            {config.littleThingCategories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="value">is&hellip;</label>
          <input
            className="input"
            id="value"
            name="value"
            placeholder={config.littleThingCategories[0]?.placeholder}
          />
        </div>
        <button className="btn">Keep it</button>
      </form>

      <ul className="mt-8 grid gap-3 md:grid-cols-2">
        {(things ?? []).map((t) => (
          <li key={t.id} className="card !p-4">
            <div className="text-xs uppercase tracking-wider text-boot">
              {t.category.replace(/_/g, " ")} · {t.recorded_date}
            </div>
            <div className="mt-1 font-display text-lg">{t.value}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
