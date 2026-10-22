import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { KIND_LABELS, MODULES, MODULE_KEYS } from "@/lib/domain/modules";
import { currentAssets, loadProfile } from "@/lib/studio/context";

export default async function Assets({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { repo, profile, access } = await loadProfile(profileId);
  const [generations, products] = await Promise.all([repo.listGenerations(profile.id), repo.listProducts(profile.id)]);
  const assets = [...currentAssets(generations).values()].sort((a, b) => MODULE_KEYS.indexOf(a.module) - MODULE_KEYS.indexOf(b.module));
  const names = new Map(products.map((p) => [p.id, p.name]));
  const href = (module: string, productId: string | null) =>
    productId ? `/studio/${profile.id}/products/${productId}/${module}` : module === "brand_blueprint" ? `/studio/${profile.id}/brand` : `/studio/${profile.id}/m/${module}`;

  return (
    <div>
      <PageHeader eyebrow="Saved assets" title="Everything you've made, in one place.">
        Each is saved with its full version history. Edit any of them, or take the lot with you.
      </PageHeader>
      <Card className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl">Your launch pack</h2>
            <p className="mt-1 text-ink-soft">Markdown files that paste cleanly into Shopify, email tools and docs — or print it.</p>
          </div>
          {access.canExport ? (
            <div className="flex flex-wrap gap-2">
              <a href={`/api/export/${profile.id}`} className="inline-flex min-h-11 items-center rounded-full bg-oxblood px-5 text-sm font-semibold text-ivory hover:bg-oxblood-deep">
                Download ZIP
              </a>
              <ButtonLink href={`/studio/${profile.id}/export/print`} variant="secondary">Printable version</ButtonLink>
            </div>
          ) : (
            <ButtonLink href="/account">Export with the Launch Pack</ButtonLink>
          )}
        </div>
      </Card>
      {assets.length === 0 ? (
        <p className="text-ink-soft">Nothing yet. <Link href={`/studio/${profile.id}`} className="font-semibold text-oxblood underline">Pick a workflow</Link> to make your first asset.</p>
      ) : (
        <ul className="divide-y divide-line rounded-3xl border border-line bg-paper">
          {assets.map((g) => (
            <li key={g.id}>
              <Link href={href(g.module, g.productId)} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-blush-soft">
                <span>
                  <span className="font-semibold">{MODULES[g.module].title}</span>
                  {g.productId ? <span className="text-ink-soft"> · {names.get(g.productId) ?? "Product"}</span> : null}
                  <span className="block text-sm text-ink-soft">Version {g.version} · {new Date(g.createdAt).toLocaleDateString()}</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <Badge tone="outline">{KIND_LABELS[MODULES[g.module].kind].label}</Badge>
                  {g.warnings.length > 0 ? <Badge tone="warning">{g.warnings.length} to check</Badge> : null}
                  {g.module !== "brand_blueprint" && g.profileVersion < profile.version ? <Badge tone="warning">Older details</Badge> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
