import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin, requireUser } from "@/lib/auth/session";
import {
  canOpen,
  continueAt,
  formatDuration,
  lessonHref,
  type Access,
  type OutlineModule,
} from "@/lib/course/outline";
import { loadAccess, loadDone, loadOutline } from "@/lib/course/queries";
import { UNLOCKED_BY } from "@/lib/course/tiers";
import { userClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Your course" };

// Course home: every module with her progress; locked modules say what
// opens them. Checked on the server (requireUser); what she can open comes
// from her entitlements in the database.
export default async function LearnPage() {
  const user = await requireUser("/learn");
  const supabase = await userClient();
  const [outline, access, done, admin] = await Promise.all([
    loadOutline(supabase),
    loadAccess(supabase),
    loadDone(supabase),
    isAdmin(),
  ]);
  const course = outline.filter((mod) => !mod.hidden && mod.lessons.length > 0);
  const library = outline.filter((mod) => mod.hidden && mod.lessons.length > 0);
  const resume = continueAt(outline, done, access);

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
      <h1 className="text-4xl">Your course</h1>
      <p className="text-mute mt-3">
        Signed in as <span data-testid="signed-in-email">{user.email}</span>
      </p>
      {admin ? <p className="text-mute">You're an admin.</p> : null}
      <nav aria-label="Course" className="mt-4 flex flex-wrap gap-x-6 gap-y-2 font-semibold">
        <Link href="/tools">Tools</Link>
        <Link href="/verdict">Product Verdict</Link>
        {admin ? <Link href="/admin">Admin</Link> : null}
      </nav>

      {resume ? (
        <Link
          href={lessonHref(resume.module, resume.lesson)}
          className="bg-accent text-on-accent mt-8 block rounded-2xl p-5 no-underline"
        >
          <span className="block text-sm font-semibold tracking-wide uppercase opacity-80">
            {done.size ? "Continue" : "Start here"}
          </span>
          <span className="mt-1 block text-xl font-semibold">
            {resume.lesson.number} {resume.lesson.title}
          </span>
        </Link>
      ) : null}

      {course.length === 0 ? <p className="mt-8">The lessons will appear here.</p> : null}

      <div className="mt-10 space-y-10">
        {course.map((mod) => (
          <ModuleSection key={mod.id} mod={mod} access={access} done={done} />
        ))}
      </div>

      {library.length ? (
        <section className="border-line mt-12 border-t pt-8" aria-labelledby="library">
          <h2 id="library" className="text-2xl">
            Library
          </h2>
          <p className="text-mute mt-2">Benchmark sheets and templates, all in one place.</p>
          {library.map((mod) => (
            <LessonList key={mod.id} mod={mod} access={access} done={done} />
          ))}
        </section>
      ) : null}

      <form action="/auth/sign-out" method="post" className="mt-12">
        <button
          type="submit"
          className="border-accent text-accent rounded-full border px-5 py-3 font-semibold"
        >
          Sign out
        </button>
      </form>
    </main>
  );
}

function ModuleSection({
  mod,
  access,
  done,
}: {
  mod: OutlineModule;
  access: Access;
  done: ReadonlySet<string>;
}) {
  const openable = mod.lessons.filter((lesson) => canOpen(lesson, access));
  const completed = mod.lessons.filter((lesson) => done.has(lesson.id)).length;
  // What opens the rest: the lowest tier among the lessons she can't open.
  const locked = mod.lessons.filter((lesson) => !canOpen(lesson, access));
  const needs = locked.some((l) => l.min_tier === "module0")
    ? "module0"
    : locked.length
      ? "course"
      : null;

  return (
    <section aria-labelledby={`module-${mod.slug}`} data-testid={`module-${mod.slug}`}>
      <h2 id={`module-${mod.slug}`} className="text-2xl">
        {mod.title}
      </h2>
      {mod.summary ? <p className="mt-2">{mod.summary}</p> : null}
      <p className="text-mute mt-2">
        {openable.length === 0
          ? `Opens with ${UNLOCKED_BY[needs ?? "course"]}.`
          : `${completed} of ${mod.lessons.length} done`}
        {openable.length > 0 && needs ? ` · ${locked.length} more with ${UNLOCKED_BY[needs]}` : ""}
      </p>
      {openable.length === 0 ? (
        <p className="mt-2">
          <Link href="/pricing">See what's included</Link>
        </p>
      ) : null}
      <LessonList mod={mod} access={access} done={done} />
    </section>
  );
}

function LessonList({
  mod,
  access,
  done,
}: {
  mod: OutlineModule;
  access: Access;
  done: ReadonlySet<string>;
}) {
  return (
    <ol className="divide-line border-line bg-paper mt-4 divide-y rounded-2xl border">
      {mod.lessons.map((lesson) => {
        const open = canOpen(lesson, access);
        const isDone = done.has(lesson.id);
        const length = formatDuration(lesson.duration_sec);
        return (
          <li key={lesson.id}>
            <Link
              href={lessonHref(mod, lesson)}
              className="text-charcoal flex items-start gap-3 px-4 py-4 no-underline"
            >
              <span
                aria-hidden
                className={`mt-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-sm ${
                  isDone ? "border-accent bg-accent text-on-accent" : "border-line"
                }`}
              >
                {isDone ? "✓" : open ? "" : "🔒"}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">
                  {lesson.number} {lesson.title}
                </span>
                <span className="text-mute block text-base">
                  {[
                    lesson.example ? "Worked example" : null,
                    length,
                    isDone ? "Done" : null,
                    open ? null : `Opens with ${UNLOCKED_BY[lesson.min_tier]}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
