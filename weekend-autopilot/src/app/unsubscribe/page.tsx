import { serviceClient } from "@/lib/supabase/server";
import { BrandLogo, Card } from "@/components/ui";
import { brand } from "@/config/brand";

export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe.
 *
 * Deliberately requires no sign-in: the token in the link is the
 * authorisation, and asking someone to log in before they can stop receiving
 * email is a dark pattern. The token only ever turns emails off, so a leaked
 * link cannot be used to read anything.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: { t?: string };
}) {
  const token = searchParams.t;
  let done = false;

  if (token && /^[0-9a-f-]{36}$/i.test(token)) {
    const { error } = await serviceClient()
      .from("notification_preferences")
      .update({ weekly_plan: false, feedback_request: false, product_updates: false })
      .eq("unsubscribe_token", token);
    done = !error;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-16">
      <BrandLogo />
      <Card className="mt-8 p-7">
        {done ? (
          <>
            <h1 className="text-[26px] leading-snug text-ink">You’re unsubscribed.</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-graphite">
              No more Thursday plans and no more Sunday questions. Your account and history are
              untouched — you can turn emails back on in settings whenever you like.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[26px] leading-snug text-ink">That link didn’t work.</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-graphite">
              It may have already been used. You can turn emails off in settings, or write to{" "}
              <a
                href={`mailto:${brand.supportEmail}`}
                className="font-semibold text-forest underline-offset-4 hover:underline"
              >
                {brand.supportEmail}
              </a>{" "}
              and we’ll do it for you.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
