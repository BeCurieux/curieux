import { notFound } from "next/navigation";
import { ReadOnly } from "@/components/studio/read-only";
import { PrintButton } from "@/components/studio/print-button";
import { MODULES, MODULE_KEYS } from "@/lib/domain/modules";
import { currentAssets, loadProfile } from "@/lib/studio/context";

export default async function PrintPack({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { repo, profile, access } = await loadProfile(profileId);
  if (!access.canExport) notFound();
  const [generations, products] = await Promise.all([
    repo.listGenerations(profile.id),
    repo.listProducts(profile.id),
  ]);
  const names = new Map(products.map((p) => [p.id, p.name]));
  const assets = [...currentAssets(generations).values()].sort(
    (a, b) => MODULE_KEYS.indexOf(a.module) - MODULE_KEYS.indexOf(b.module),
  );
  return (
    <article className="mx-auto max-w-3xl">
      <div className="no-print mb-6">
        <PrintButton />
      </div>
      <header className="border-line mb-10 border-b pb-6">
        <p className="eyebrow">Launch pack</p>
        <h1 className="mt-2 text-5xl">{profile.brandName}</h1>
        <p className="text-ink-soft mt-2">
          Check every fact, claim and image before you publish. Sidekick prompts are instructions;
          photo briefs are plans.
        </p>
      </header>
      {assets.map((g) => (
        <section key={g.id} className="mb-12 break-before-page">
          <h2 className="mb-4 text-3xl">
            {MODULES[g.module].title}
            {g.productId ? (
              <span className="text-ink-soft block text-xl">{names.get(g.productId)}</span>
            ) : null}
          </h2>
          <ReadOnly value={g.output} />
        </section>
      ))}
    </article>
  );
}
