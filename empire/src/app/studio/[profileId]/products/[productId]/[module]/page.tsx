import Link from "next/link";
import { notFound } from "next/navigation";
import { MODULES, isModuleKey } from "@/lib/domain/modules";
import { ModuleView } from "@/components/studio/module-view";
import { loadProfile } from "@/lib/studio/context";

export default async function ProductModule({
  params,
}: {
  params: Promise<{ profileId: string; productId: string; module: string }>;
}) {
  const { profileId, productId, module } = await params;
  if (!isModuleKey(module) || MODULES[module].scope !== "product") notFound();
  const { repo, profile } = await loadProfile(profileId);
  const product = await repo.getProduct(productId);
  if (!product || product.profileId !== profile.id) notFound();
  return (
    <div className="space-y-4">
      <Link
        href={`/studio/${profile.id}/products/${product.id}`}
        className="no-print text-oxblood text-sm font-semibold underline"
      >
        ← {product.name}
      </Link>
      <ModuleView
        profileId={profile.id}
        module={module}
        productId={product.id}
        context={product.name}
      />
    </div>
  );
}
