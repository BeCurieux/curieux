import Link from "next/link";
import { notFound } from "next/navigation";
import {
  deleteProductAction,
  removeProductImageAction,
  uploadProductImageAction,
} from "@/app/studio/actions";
import { ProductForm } from "@/components/studio/product-form";
import { UploadForm } from "@/components/studio/profile-edit-form";
import { Badge, Card, Notice, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { moduleAllowed } from "@/lib/billing/plans";
import { missingProductInformation } from "@/lib/domain/product";
import { currentAssets, loadProfile } from "@/lib/studio/context";

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string; productId: string }>;
  searchParams: Promise<{ added?: string }>;
}) {
  const { profileId, productId } = await params;
  const { added } = await searchParams;
  const { repo, profile, access } = await loadProfile(profileId);
  const product = await repo.getProduct(productId);
  if (!product || product.profileId !== profile.id) notFound();
  const assets = currentAssets(await repo.listGenerations(profile.id, { productId: product.id }));
  const gaps = missingProductInformation(product, profile.fulfilment);
  const base = `/studio/${profile.id}/products/${product.id}`;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Product" title={product.name} />
      {added ? (
        <Notice tone="success">Product saved. Now make its listing and photo briefs.</Notice>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            [
              "product_listing",
              "Product listing",
              "Title, descriptions, bullets, specs, FAQ and SEO.",
            ],
            [
              "image_briefs",
              "Photo and mockup briefs",
              "Shot plans, Canva steps and safe editing prompts.",
            ],
          ] as const
        ).map(([module, title, body]) => (
          <Link
            key={module}
            href={`${base}/${module}`}
            className="group border-line bg-paper hover:border-oxblood block rounded-3xl border p-6"
          >
            <h2 className="text-2xl group-hover:underline">{title}</h2>
            <p className="text-ink-soft mt-2">{body}</p>
            <div className="mt-3">
              {assets.has(`${module}:${product.id}`) ? (
                <Badge tone="success">Made</Badge>
              ) : moduleAllowed(access, module) ? (
                <Badge tone="blush">Not made yet</Badge>
              ) : (
                <Badge tone="outline">Launch Pack</Badge>
              )}
            </div>
          </Link>
        ))}
      </div>
      {gaps.length > 0 ? (
        <Notice tone="warning" title="Worth adding before you generate">
          <ul className="list-disc space-y-1 pl-5">
            {gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Notice>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card>
          <h2 className="mb-6 text-2xl">Product facts</h2>
          <ProductForm profileId={profile.id} productId={product.id} defaults={product} />
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="text-xl">Your photos</h2>
            {product.imagePaths.length > 0 ? (
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {product.imagePaths.map((key, i) => (
                  <li key={key} className="space-y-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/uploads/${key}`}
                      alt={`Photo ${i + 1} of ${product.name}`}
                      className="aspect-square w-full rounded-xl object-cover"
                    />
                    <form action={removeProductImageAction.bind(null, product.id, key)}>
                      <button className="text-ink-soft hover:text-danger min-h-9 text-xs">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-soft mt-2 text-sm">
                Optional. Your photos stay private to you.
              </p>
            )}
            <div className="mt-4">
              <UploadForm
                action={uploadProductImageAction.bind(null, product.id)}
                field="photo"
                label="Add a photo"
                hint="JPEG, PNG or WebP, up to 5 MB. Up to eight."
              />
            </div>
          </Card>
          <Card>
            <h2 className="text-xl">Remove product</h2>
            <p className="text-ink-soft mt-2 text-sm">
              Deletes the product, its photos and its listings and briefs.
            </p>
            <form action={deleteProductAction.bind(null, product.id)} className="mt-3">
              <Button variant="danger" type="submit">
                Delete {product.name}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
