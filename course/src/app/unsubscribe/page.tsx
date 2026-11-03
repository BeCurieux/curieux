import type { Metadata } from "next";
import Link from "next/link";
import { emailSecret } from "@/lib/email/send";
import { decodeEmail, verifyUnsubscribe } from "@/lib/email/unsubscribe";
import { confirmUnsubscribe } from "./actions";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

// From the link in every marketing email. Asks first (a button, so a mail
// scanner fetching the link doesn't unsubscribe her), then stops the nudges
// and onboarding emails. Receipts and sign-in links still come.
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; t?: string; status?: string }>;
}) {
  const { e = "", t = "", status } = await searchParams;
  const email = decodeEmail(e);
  const valid = email !== null && verifyUnsubscribe(email, t, emailSecret());

  return (
    <main id="main" className="mx-auto w-full max-w-md px-5 py-12">
      <h1 className="text-4xl">Unsubscribe</h1>
      {status === "done" ? (
        <p className="mt-6 text-lg" role="status">
          Done. You won't get any more course tips or reminders. Receipts and sign-in links still
          come when you need them.
        </p>
      ) : status === "bad" || !valid ? (
        <p className="mt-6 text-lg" data-testid="unsubscribe-bad">
          That link doesn't look right. Use the link in your most recent email, or turn emails off
          from <Link href="/account">your account</Link>.
        </p>
      ) : (
        <form action={confirmUnsubscribe} className="mt-6">
          <input type="hidden" name="e" value={e} />
          <input type="hidden" name="t" value={t} />
          <p className="text-lg">
            Stop course tips and reminders to <strong>{email}</strong>? Receipts and sign-in links
            still come.
          </p>
          {status === "failed" ? (
            <p role="alert" className="text-danger mt-4">
              That didn't work. Please try again.
            </p>
          ) : null}
          <button
            type="submit"
            className="bg-accent text-on-accent mt-6 w-full rounded-full px-6 py-4 text-lg font-semibold"
          >
            Unsubscribe
          </button>
        </form>
      )}
    </main>
  );
}
