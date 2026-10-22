import Link from "next/link";
import { ProductForm } from "@/components/studio/product-form";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { missingProductInformation } from "@/lib/domain/product";
import { currentAssets, loadProfile } from "@/lib/studio/context";

export default async function Products({ params }: { params: Promise<{ profileId: string }> }) {
  const { profileId } = await params;
  const { repo, profile, access } = await loadProfile(profileId);
  const [products, generations] = await Promise.all([
    repo.listProducts(profile.id),
    repo.listGenerations(profile.id),
  ]);
  const assets = currentAssets(generations);
  const full = products.length >= access.productsPerProfile;
  return (
    <div>
      <PageHeader eyebrow="Product Writer" title="Real facts in. Listings you can paste out.">
        Add a product with everything you know. Missing details get flagged — never filled in for
        you.
      </PageHeader>
      {products.length > 0 ? (
        <ul className="mb-10 grid gap-4 md:grid-cols-2">
          {products.map((p) => {
            const gaps = missingProductInformation(p, profile.fulfilment).length;
            return (
              <li key={p.id}>
                <Link
                  href={`/studio/${profile.id}/products/${p.id}`}
                  className="group border-line bg-paper hover:border-aubergine block rounded-3xl border p-6"
                >
                  <h2 className="text-2xl group-hover:underline">{p.name}</h2>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assets.has(`product_listing:${p.id}`) ? (
                      <Badge tone="success">Listing made</Badge>
                    ) : (
                      <Badge tone="blush">No listing yet</Badge>
                    )}
                    {assets.has(`image_briefs:${p.id}`) ? (
                      <Badge tone="success">Photo briefs made</Badge>
                    ) : null}
                    {gaps > 0 ? (
                      <Badge tone="warning">
                        {gaps} detail{gaps === 1 ? "" : "s"} missing
                      </Badge>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Card>
        <h2 className="text-2xl">
          {products.length === 0 ? "Add your first product" : "Add another product"}
        </h2>
        <p className="text-mute mt-1 mb-6 text-sm">
          {products.length} of {access.productsPerProfile} product
          {access.productsPerProfile === 1 ? "" : "s"} on your plan.
        </p>
        {full ? (
          <p>
            {access.plan === "free"
              ? "The free studio holds one product. The Launch Pack holds up to ten."
              : "That's every product your pack covers."}
          </p>
        ) : (
          <ProductForm profileId={profile.id} />
        )}
      </Card>
    </div>
  );
}
