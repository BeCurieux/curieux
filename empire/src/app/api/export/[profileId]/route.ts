import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { repoFor } from "@/lib/data";
import { packFiles, slug, zipPack } from "@/lib/export/pack";
import { loadAccess } from "@/lib/generation/run";
import { currentAssets } from "@/lib/studio/context";
import { track } from "@/lib/analytics/track";

// The whole launch pack as a ZIP. Hers only, Launch Pack only.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ profileId: string }> },
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const repo = await repoFor(user);
  const { profileId } = await params;
  const profile = await repo.getProfile(profileId);
  if (!profile) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { access } = await loadAccess(repo);
  if (!access.canExport)
    return NextResponse.json(
      { error: "The full export is part of the Launch Pack." },
      { status: 403 },
    );

  const [products, generations, tasks] = await Promise.all([
    repo.listProducts(profile.id),
    repo.listGenerations(profile.id),
    repo.listTasks(profile.id),
  ]);
  const files = packFiles(profile, products, [...currentAssets(generations).values()], tasks);
  const root = `${slug(profile.brandName)}-launch-pack`;
  const zip = zipPack(files, root);
  await track("pack_exported", user.id, { format: "zip" });
  return new NextResponse(Buffer.from(zip), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${root}.zip"`,
      "cache-control": "private, no-store",
    },
  });
}
