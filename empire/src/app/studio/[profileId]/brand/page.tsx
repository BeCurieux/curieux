import Link from "next/link";
import { ModuleView } from "@/components/studio/module-view";
import { Card, Notice } from "@/components/ui/card";
import { loadProfile } from "@/lib/studio/context";

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { profileId } = await params;
  const { welcome } = await searchParams;
  const { repo, profile } = await loadProfile(profileId);
  const history = await repo.listProfileVersions(profile.id);
  return (
    <div className="space-y-8">
      {welcome ? (
        <Notice tone="success" title={`Welcome, ${profile.brandName}.`}>
          Your business details are saved. Next: your Brand Blueprint — everything else builds on
          it.
        </Notice>
      ) : null}
      <ModuleView profileId={profile.id} module="brand_blueprint" />
      <Card>
        <h2 className="text-2xl">Your business details</h2>
        <p className="text-mute mt-2">
          The facts every generator reads. Changing them never rewrites existing assets — you choose
          what to regenerate.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <Link
            href={`/studio/${profile.id}/profile`}
            className="text-aubergine font-semibold underline"
          >
            Edit business details
          </Link>
        </div>
        <details className="mt-5">
          <summary className="cursor-pointer text-sm font-semibold">
            Profile history ({history.length} versions)
          </summary>
          <ol className="text-mute mt-3 space-y-1 text-sm">
            {history.slice(0, 20).map((v) => (
              <li key={v.id}>
                Version {v.version} · {v.note} · {new Date(v.createdAt).toLocaleString()}
              </li>
            ))}
          </ol>
        </details>
      </Card>
    </div>
  );
}
