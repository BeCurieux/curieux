import Link from "next/link";
import { tasksFor } from "@/lib/checklist/tasks";
import { MODULES, type ModuleKey } from "@/lib/domain/modules";
import { STAGE_LABELS } from "@/lib/domain/profile";
import { currentAssets, loadProfile } from "@/lib/studio/context";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Notice } from "@/components/ui/card";

const WORKFLOWS = [
  {
    title: "Design my Shopify store",
    body: "A design brief, ten Sidekick prompts and homepage copy.",
    href: "theme",
    modules: ["theme_brief", "theme_prompts", "homepage_copy"],
  },
  {
    title: "Write my product listing",
    body: "Titles, descriptions, specs, FAQ and SEO from your real facts.",
    href: "products",
    modules: ["product_listing"],
  },
  {
    title: "Plan my product photography",
    body: "Shot-by-shot briefs, Canva steps and safe editing prompts.",
    href: "mockups",
    modules: ["image_briefs"],
  },
  {
    title: "Create my launch marketing",
    body: "An announcement, three emails, Reels, captions and a 7-day plan.",
    href: "marketing",
    modules: ["email_sequence", "social_content"],
  },
  {
    title: "Build my launch checklist",
    body: "Payments, policies, delivery, a test order — tracked as you go.",
    href: "launch",
    modules: [],
  },
] as const;

export default async function Overview({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { repo, profile, access, used } = await loadProfile(profileId);
  const [generations, tasks] = await Promise.all([
    repo.listGenerations(profile.id),
    repo.listTasks(profile.id),
  ]);
  const assets = currentAssets(generations);
  const made = new Set([...assets.values()].map((g) => g.module));
  const applicable = new Set(tasksFor(profile).map((t) => t.key));
  const relevant = tasks.filter((t) => applicable.has(t.taskKey));
  const done = relevant.filter(
    (t) => t.status === "complete" || t.status === "not_applicable",
  ).length;
  const stale = [...assets.values()].filter(
    (g) => g.module !== "brand_blueprint" && g.profileVersion < profile.version,
  );

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="eyebrow">{STAGE_LABELS[profile.stage]}</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">
          What shall we build for {profile.brandName} today?
        </h1>
        <p className="text-ink-soft mt-3 text-lg">
          Pick one. Each workflow reads your Brand Blueprint, so it all fits together.
        </p>
      </header>

      {!profile.brand ? (
        <Card className="bg-oxblood text-ivory">
          <p className="eyebrow text-blush">Start here</p>
          <h2 className="text-ivory mt-2 text-3xl">Make your Brand Blueprint first</h2>
          <p className="text-blush mt-2 max-w-2xl">
            It takes a moment, and everything else uses it: your colours, fonts and voice.
          </p>
          <div className="mt-5">
            <Link
              href={`/studio/${profile.id}/brand`}
              className="bg-ivory text-oxblood inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold"
            >
              Build my blueprint
            </Link>
          </div>
        </Card>
      ) : null}

      {stale.length > 0 ? (
        <Notice tone="warning" title="Some assets were made from older business details">
          {stale
            .map((g) => MODULES[g.module].title)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(", ")}
          . Open them to regenerate, or keep them as they are — it's your call.
        </Notice>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {WORKFLOWS.map((w) => {
          const doneCount = w.modules.filter((m) => made.has(m as ModuleKey)).length;
          return (
            <li key={w.href}>
              <Link
                href={`/studio/${profile.id}/${w.href}`}
                className="group border-line bg-paper hover:border-oxblood block h-full rounded-3xl border p-6 transition-colors"
              >
                <h2 className="text-2xl group-hover:underline">{w.title}</h2>
                <p className="text-ink-soft mt-2">{w.body}</p>
                <p className="text-oxblood mt-4 text-sm font-semibold">
                  {w.href === "launch"
                    ? `${done} of ${relevant.length} done`
                    : w.modules.length > 0
                      ? `${doneCount} of ${w.modules.length} made`
                      : ""}
                  {" →"}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl">Your plan</h2>
            <p className="text-ink-soft mt-1">
              {access.plan === "free"
                ? "Free studio"
                : `Launch Pack${access.packs > 1 ? ` × ${access.packs}` : ""}`}{" "}
              · {Math.max(0, access.generations - used)} of {access.generations} generations left
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="outline">Saved assets: {assets.size}</Badge>
            {access.plan === "free" ? (
              <ButtonLink href="/account">Get the Launch Pack</ButtonLink>
            ) : (
              <ButtonLink href={`/studio/${profile.id}/assets`} variant="secondary">
                Download your pack
              </ButtonLink>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
