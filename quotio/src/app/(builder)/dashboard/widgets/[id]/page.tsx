import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Builder } from "@/components/builder/Builder";
import { hydrateDocument } from "@/lib/widget/schema";
import { appUrl } from "@/config/brand";
import { currentUser, isRegistered } from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { can, PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Editing" };
export const dynamic = "force-dynamic";

export default async function BuilderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { note?: string };
}) {
  const user = await currentUser();
  if (!user) redirect("/dashboard");

  const widget = await getStore().getWidget(params.id);
  if (!widget || widget.ownerId !== user.id) notFound();

  const plan = PLANS[user.plan];

  return (
    <Builder
      widgetId={widget.id}
      slug={widget.slug}
      // Hydrated because the draft comes back from the store as the raw JSON
      // it was written as, which may predate fields the schema has since
      // gained. The rendering paths get this free via toRenderable; the
      // builder is the one place that hands a document straight to the client.
      initialDocument={hydrateDocument(widget.draft)}
      initialStatus={widget.status}
      origin={appUrl()}
      isRegistered={isRegistered(user)}
      planName={plan.name}
      capabilities={{
        leadCapture: can(user.plan, "leadCapture"),
        removeBadge: can(user.plan, "removeBadge"),
        premiumThemes: can(user.plan, "premiumThemes"),
        advancedLogic: can(user.plan, "advancedLogic"),
      }}
      note={searchParams.note?.slice(0, 300)}
    />
  );
}
