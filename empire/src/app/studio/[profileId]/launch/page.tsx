import { Checklist } from "@/components/studio/checklist";
import { ButtonLink } from "@/components/ui/button";
import { Card, Notice, PageHeader } from "@/components/ui/card";
import { CATEGORIES, taskByKey, tasksFor } from "@/lib/checklist/tasks";
import { loadProfile } from "@/lib/studio/context";

export default async function Launch({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { repo, profile, access } = await loadProfile(profileId);
  // Make sure every task that applies exists (e.g. after a profile change).
  const applicable = tasksFor(profile);
  await repo.ensureTasks(profile.id, applicable.map((t) => ({ taskKey: t.key, category: t.category, label: t.label, status: "not_started" as const })));
  const stored = await repo.listTasks(profile.id);
  const keys = new Set(applicable.map((t) => t.key));
  const rows = stored
    .filter((t) => keys.has(t.taskKey))
    .map((t) => ({ ...taskByKey(t.taskKey)!, id: t.id, status: t.status, notes: t.notes }))
    .sort((a, b) => CATEGORIES.indexOf(a.category as never) - CATEGORIES.indexOf(b.category as never));
  const done = rows.filter((t) => t.status === "complete" || t.status === "not_applicable").length;
  const preview = access.plan === "free";

  return (
    <div>
      <PageHeader eyebrow="Launch Workspace" title="Everything between you and your first order.">
        {done} of {rows.length} done. Adapted to {profile.fulfilment === "digital" ? "a digital" : profile.fulfilment === "both" ? "a physical and digital" : "a physical"} product business. Progress saves as you go.
      </PageHeader>
      <div className="mb-8 space-y-4">
        <Notice tone="info" title="A checklist, not a certificate">
          Ticking every task doesn't make your store legally compliant. Policies, tax and consumer law differ by country —
          check yours with a qualified adviser.
        </Notice>
        {preview ? (
          <Card className="bg-blush-soft">
            <p>You can see the full checklist. Tracking progress and notes is part of the Launch Pack.</p>
            <div className="mt-3"><ButtonLink href="/account">See the Launch Pack</ButtonLink></div>
          </Card>
        ) : null}
      </div>
      <Checklist tasks={rows} readOnly={preview} />
    </div>
  );
}
