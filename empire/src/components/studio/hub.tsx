import Link from "next/link";
import { KIND_LABELS, MODULES, type ModuleKey } from "@/lib/domain/modules";
import { moduleAllowed } from "@/lib/billing/plans";
import { currentAssets, loadProfile } from "@/lib/studio/context";
import { Badge, Card, PageHeader } from "@/components/ui/card";

// A studio's front page: its modules, whether each is made, and the honest
// notes that apply to all of them.
export async function HubPage({
  profileId,
  eyebrow,
  title,
  intro,
  modules,
  safety,
}: {
  profileId: string;
  eyebrow: string;
  title: string;
  intro: string;
  modules: ModuleKey[];
  safety: string[];
}) {
  const { repo, profile, access } = await loadProfile(profileId);
  const assets = currentAssets(await repo.listGenerations(profile.id));
  return (
    <div>
      <PageHeader eyebrow={eyebrow} title={title}>
        {intro}
      </PageHeader>
      <ol className="grid gap-4 md:grid-cols-3">
        {modules.map((module, i) => {
          const info = MODULES[module];
          const made = assets.get(`${module}:-`);
          return (
            <li key={module}>
              <Link
                href={`/studio/${profile.id}/m/${module}`}
                className="group border-line bg-paper hover:border-oxblood block h-full rounded-3xl border p-6"
              >
                <p className="eyebrow">Step {i + 1}</p>
                <h2 className="mt-2 text-2xl group-hover:underline">{info.title}</h2>
                <p className="text-ink-soft mt-2">{info.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="outline">{KIND_LABELS[info.kind].label}</Badge>
                  {made ? (
                    <Badge tone="success">Made · v{made.version}</Badge>
                  ) : moduleAllowed(access, module) ? (
                    <Badge tone="blush">Not made yet</Badge>
                  ) : (
                    <Badge tone="outline">Launch Pack</Badge>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
      <Card className="bg-blush-soft mt-8">
        <h2 className="text-2xl">Before you start</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          {safety.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
