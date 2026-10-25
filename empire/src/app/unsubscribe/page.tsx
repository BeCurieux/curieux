import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/shell/site-header";
import { Card } from "@/components/ui/card";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

// The link in every email. A button rather than an automatic unsubscribe,
// because mail scanners open links on their own.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-lg px-5 py-10 sm:px-8">
        <Card>
          <h1 className="text-3xl">Stop the emails</h1>
          {token ? (
            <>
              <p className="text-mute mt-3">One click and you won&apos;t hear from us again.</p>
              <div className="mt-5">
                <UnsubscribeButton token={token} />
              </div>
            </>
          ) : (
            <p className="text-mute mt-3">
              This link is missing its code. Use the unsubscribe link in any of our emails, or write
              to hello@herlittleempire.com and we&apos;ll take you off by hand.
            </p>
          )}
        </Card>
      </main>
      <SiteFooter />
    </>
  );
}
