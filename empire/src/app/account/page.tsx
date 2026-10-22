import type { Metadata } from "next";
import { serverEnv } from "@/env";
import { CATALOGUE } from "@/content/catalogue";
import { LAUNCH_PACK } from "@/lib/billing/plans";
import { loadAccess } from "@/lib/generation/run";
import { studio } from "@/lib/studio/context";
import { Button } from "@/components/ui/button";
import { Badge, Card, Notice, PageHeader } from "@/components/ui/card";
import { ClaimForm, DeleteAccount, FindPurchases } from "./forms";
import { devGrantAction } from "./actions";

export const metadata: Metadata = { title: "Account and billing" };

export default async function Account() {
  const { user, repo } = await studio();
  const [{ access, used }, entitlements, usage] = await Promise.all([
    loadAccess(repo),
    repo.listEntitlements(),
    repo.listUsage(new Date(0).toISOString()),
  ]);
  const env = serverEnv();
  const refunded = entitlements.filter(
    (e) => e.status === "refunded" && e.productType === "launch_pack",
  );
  const library = CATALOGUE.filter((item) => access.library.includes(item.slug));
  const failed = usage.filter((u) => u.operation === "generate_failed").length;

  return (
    <main id="main" className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <PageHeader eyebrow="Account and billing" title="Your plan, purchases and data.">
        Signed in as {user.email}.
      </PageHeader>
      <div className="space-y-6">
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl">
              {access.plan === "free" ? "Free studio" : LAUNCH_PACK.name}
            </h2>
            {access.packs > 1 ? <Badge>× {access.packs}</Badge> : null}
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-ink-soft text-sm">Generations used</dt>
              <dd className="font-serif text-3xl">
                {used} / {access.generations}
              </dd>
            </div>
            <div>
              <dt className="text-ink-soft text-sm">Businesses</dt>
              <dd className="font-serif text-3xl">{access.profiles}</dd>
            </div>
            <div>
              <dt className="text-ink-soft text-sm">Products per business</dt>
              <dd className="font-serif text-3xl">{access.productsPerProfile}</dd>
            </div>
          </dl>
          {failed > 0 ? (
            <p className="text-ink-soft mt-3 text-sm">
              {failed} attempt{failed === 1 ? "" : "s"} that didn't work weren't counted.
            </p>
          ) : null}
          {refunded.length > 0 ? (
            <div className="mt-4">
              <Notice tone="info">
                A Launch Pack on this account was refunded. Your saved work is still here; new
                generations and exports have stopped.
              </Notice>
            </div>
          ) : null}
        </Card>

        {access.plan === "free" || access.generations - used < 10 ? (
          <Card className="border-oxblood">
            <h2 className="text-2xl">
              {access.plan === "free" ? `Get the ${LAUNCH_PACK.name}` : "Need another pack?"}
            </h2>
            <p className="text-ink-soft mt-2">
              {LAUNCH_PACK.priceLabel} once. {LAUNCH_PACK.generationsPerPack} generations, up to{" "}
              {LAUNCH_PACK.productsPerPack} products, every studio unlocked, and the full export.
              Everything you make stays yours. {LAUNCH_PACK.refundDays}-day no-questions refund.
            </p>
            <div className="mt-5">
              {env.GUMROAD_PRODUCT_URL ? (
                <a
                  href="/api/billing/checkout"
                  className="bg-oxblood text-ivory hover:bg-oxblood-deep inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold"
                >
                  Buy on Gumroad
                </a>
              ) : (
                <p className="text-ink-soft text-sm">
                  Checkout isn't connected in this environment (GUMROAD_PRODUCT_URL).
                </p>
              )}
            </div>
            <p className="text-ink-soft mt-3 text-sm">
              Use the same email ({user.email}) at checkout and it unlocks automatically.
            </p>
            {env.EMPIRE_BACKEND === "local" ? (
              <form action={devGrantAction} className="mt-4">
                <Button type="submit" variant="secondary">
                  Local only: give me a Launch Pack
                </Button>
              </form>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <h2 className="text-2xl">Already paid?</h2>
          <div className="mt-4 space-y-6">
            <FindPurchases />
            <ClaimForm />
          </div>
        </Card>

        <Card>
          <h2 className="text-2xl">Your Her Little Empire library</h2>
          <p className="text-ink-soft mt-2">
            Downloads you bought before — separate from the Launch Pack software. They stay on
            Gumroad, exactly as you bought them.
          </p>
          {library.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {library.map((item) => (
                <li
                  key={item.slug}
                  className="border-line flex flex-wrap items-center justify-between gap-2 rounded-2xl border p-4"
                >
                  <span className="font-semibold">{item.title}</span>
                  <a
                    href="https://app.gumroad.com/library"
                    className="text-oxblood text-sm font-semibold underline"
                  >
                    Open in Gumroad library
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm">Nothing linked to {user.email} yet.</p>
          )}
        </Card>

        <Card>
          <h2 className="text-2xl">Your data</h2>
          <p className="text-ink-soft mt-2">
            Everything you've entered and made, as one JSON file.
          </p>
          <a
            href="/api/account/data"
            className="border-oxblood text-oxblood hover:bg-blush-soft mt-3 inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-semibold"
          >
            Download my data
          </a>
          <div className="border-line mt-8 border-t pt-6">
            <h3 className="text-xl">Delete account</h3>
            <div className="mt-3">
              <DeleteAccount />
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
