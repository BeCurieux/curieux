import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { repoFor } from "@/lib/data";

// Everything she owns, as JSON — her copy of her data.
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "sign in" }, { status: 401 });
  const repo = await repoFor(user);
  const profiles = await repo.listProfiles();
  const data = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    entitlements: await repo.listEntitlements(),
    usage: await repo.listUsage(new Date(0).toISOString()),
    businesses: await Promise.all(
      profiles.map(async (profile) => ({
        profile,
        history: await repo.listProfileVersions(profile.id),
        products: await repo.listProducts(profile.id),
        generations: await repo.listGenerations(profile.id),
        tasks: await repo.listTasks(profile.id),
      })),
    ),
  };
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": 'attachment; filename="empire-studio-data.json"',
      "cache-control": "private, no-store",
    },
  });
}
