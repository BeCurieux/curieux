import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { currentAssets, loadProfile } from "@/lib/studio/context";
import { ButtonLink } from "@/components/ui/button";

export default async function Mockups({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { repo, profile } = await loadProfile(profileId);
  const [products, generations] = await Promise.all([repo.listProducts(profile.id), repo.listGenerations(profile.id)]);
  const assets = currentAssets(generations);
  return (
    <div>
      <PageHeader eyebrow="Mockup Studio" title="Briefs for photos of your real product.">
        Shot plans, Canva steps and careful editing prompts. These are briefs — the photos are yours to take.
      </PageHeader>
      <Card className="mb-8 bg-blush-soft">
        <h2 className="text-xl">Keep it truthful</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Every image must show what the customer will actually receive — colour, size, label, finish.</li>
          <li>AI image tools often get lettering, logos and proportions wrong. Check every edit against the product.</li>
          <li>Label illustrative or mockup images as illustrations.</li>
        </ul>
      </Card>
      {products.length === 0 ? (
        <Card>
          <p>Add a product first — briefs are written from its real details.</p>
          <div className="mt-4"><ButtonLink href={`/studio/${profile.id}/products`}>Add a product</ButtonLink></div>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {products.map((p) => (
            <li key={p.id}>
              <Link href={`/studio/${profile.id}/products/${p.id}/image_briefs`} className="group block rounded-3xl border border-line bg-paper p-6 hover:border-oxblood">
                <h2 className="text-2xl group-hover:underline">{p.name}</h2>
                <div className="mt-3">{assets.has(`image_briefs:${p.id}`) ? <Badge tone="success">Briefs made</Badge> : <Badge tone="blush">Not made yet</Badge>}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
