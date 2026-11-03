import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/markdown";
import { serverEnv } from "@/env";
import { requireUser } from "@/lib/auth/session";
import { formatDuration, lessonHref, neighbours } from "@/lib/course/outline";
import { loadOutline } from "@/lib/course/queries";
import { UNLOCKED_BY } from "@/lib/course/tiers";
import { videoEmbedUrl } from "@/lib/course/video";
import { userClient } from "@/lib/supabase/server";
import { setLessonDone } from "../../actions";

type Params = Promise<{ module: string; lesson: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const supabase = await userClient();
  const { data } = await supabase
    .from("lessons")
    .select("number, title, modules!inner(slug)")
    .eq("slug", lessonSlug)
    .eq("modules.slug", moduleSlug)
    .maybeSingle();
  return { title: data ? `${data.number} ${data.title}` : "Lesson" };
}

// One lesson. Gated by min_tier on the server: the video id and script come
// from lesson_content(), which returns nothing unless her entitlements open
// the lesson, so a locked lesson can't render them even by mistake.
export default async function LessonPage({ params }: { params: Params }) {
  const { module: moduleSlug, lesson: lessonSlug } = await params;
  const path = `/learn/${moduleSlug}/${lessonSlug}`;
  await requireUser(path);
  const supabase = await userClient();

  const outline = await loadOutline(supabase);
  const mod = outline.find((m) => m.slug === moduleSlug);
  const lesson = mod?.lessons.find((l) => l.slug === lessonSlug);
  if (!mod || !lesson) notFound();

  const [content, assets, progress] = await Promise.all([
    supabase.rpc("lesson_content", { p_lesson: lesson.id }).maybeSingle<{
      video_provider: "bunny" | "youtube" | null;
      video_id: string | null;
      script_md: string;
    }>(),
    supabase
      .from("lesson_assets")
      .select("id, label, kind")
      .eq("lesson_id", lesson.id)
      .order("label"),
    supabase.from("lesson_progress").select("id").eq("lesson_id", lesson.id).maybeSingle(),
  ]);
  if (content.error) throw new Error(`lesson_content: ${content.error.message}`);
  const { previous, next } = neighbours(outline, lesson.id);
  const length = formatDuration(lesson.duration_sec);

  const header = (
    <>
      <p className="text-mute">
        <Link href="/learn">Your course</Link> · {mod.title}
      </p>
      <h1 className="mt-3 text-3xl sm:text-4xl">
        <span className="text-mute block text-xl">Lesson {lesson.number}</span>
        {lesson.title}
      </h1>
      <p className="text-mute mt-3">
        {[lesson.example ? "Worked example" : null, length].filter(Boolean).join(" · ")}
      </p>
    </>
  );

  if (!content.data) {
    return (
      <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
        {header}
        {lesson.summary ? <p className="mt-6 text-lg">{lesson.summary}</p> : null}
        <div
          className="border-line bg-paper mt-8 rounded-2xl border p-6"
          data-testid="lesson-locked"
        >
          <h2 className="text-2xl">This lesson is locked</h2>
          <p className="mt-3">
            It opens with {UNLOCKED_BY[lesson.min_tier]}
            {lesson.opens_with_benchmark_pack ? " or the benchmark pack" : ""}.
          </p>
          <p className="mt-4">
            <Link href="/pricing">See what's included</Link>
          </p>
        </div>
        <LessonNav previous={previous} next={next} />
      </main>
    );
  }

  const { video_provider, video_id, script_md } = content.data;
  const env = serverEnv();
  const embed =
    video_provider && video_id
      ? videoEmbedUrl(video_provider, video_id, {
          bunnyLibraryId: env.BUNNY_STREAM_LIBRARY_ID,
          bunnyTokenKey: env.BUNNY_STREAM_TOKEN_KEY,
        })
      : null;
  const isDone = Boolean(progress.data);

  return (
    <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
      {header}

      {video_provider ? (
        embed ? (
          <div className="bg-charcoal mt-6 aspect-video overflow-hidden rounded-2xl">
            <iframe
              src={embed}
              title={`Video: ${lesson.title}`}
              className="size-full"
              loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <p className="bg-danger-soft text-danger mt-6 rounded-xl p-4" role="status">
            The video isn't set up yet. Read the lesson below instead.
          </p>
        )
      ) : null}

      {script_md ? (
        embed ? (
          <details
            className="border-line bg-paper mt-6 rounded-2xl border p-5"
            data-testid="script"
          >
            <summary className="cursor-pointer text-lg font-semibold">Read instead</summary>
            <div className="mt-4">
              <Markdown>{script_md}</Markdown>
            </div>
          </details>
        ) : (
          <div className="mt-6" data-testid="script">
            <Markdown>{script_md}</Markdown>
          </div>
        )
      ) : null}

      {assets.data?.length ? (
        <section className="mt-8" aria-labelledby="downloads">
          <h2 id="downloads" className="text-2xl">
            Downloads
          </h2>
          <ul className="mt-3 space-y-2">
            {assets.data.map((asset) => (
              <li key={asset.id}>
                <a href={`/api/assets/${asset.id}`} className="font-semibold">
                  {asset.label}
                </a>{" "}
                <span className="text-mute">({asset.kind})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <form action={setLessonDone} className="mt-10">
        <input type="hidden" name="lessonId" value={lesson.id} />
        <input type="hidden" name="path" value={path} />
        <input type="hidden" name="done" value={isDone ? "false" : "true"} />
        {isDone ? (
          <p className="flex flex-wrap items-center gap-3">
            <span className="font-semibold" role="status">
              ✓ Lesson done
            </span>
            <button type="submit" className="text-mute underline underline-offset-4">
              Mark as not done
            </button>
          </p>
        ) : (
          <button
            type="submit"
            className="bg-accent text-on-accent w-full rounded-full px-6 py-4 text-lg font-semibold sm:w-auto"
          >
            Mark lesson done
          </button>
        )}
      </form>

      {isDone && next ? (
        <Link
          href={lessonHref(next.module, next.lesson)}
          className="bg-accent text-on-accent mt-6 block rounded-2xl p-5 no-underline"
          data-testid="next-prompt"
        >
          <span className="block text-sm font-semibold tracking-wide uppercase opacity-80">
            Up next
          </span>
          <span className="mt-1 block text-xl font-semibold">
            {next.lesson.number} {next.lesson.title}
          </span>
        </Link>
      ) : null}
      {isDone && !next ? (
        <p className="mt-6">
          That's the last lesson here. <Link href="/learn">Back to your course</Link>
        </p>
      ) : null}

      <LessonNav previous={previous} next={next} />
    </main>
  );
}

type Neighbour = ReturnType<typeof neighbours>["next"];

function LessonNav({ previous, next }: { previous: Neighbour; next: Neighbour }) {
  if (!previous && !next) return null;
  return (
    <nav
      aria-label="Lessons"
      className="border-line mt-10 flex justify-between gap-4 border-t pt-6"
    >
      {previous ? (
        <Link href={lessonHref(previous.module, previous.lesson)}>← {previous.lesson.number}</Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={lessonHref(next.module, next.lesson)}>
          {next.lesson.number} {next.lesson.title} →
        </Link>
      ) : null}
    </nav>
  );
}
