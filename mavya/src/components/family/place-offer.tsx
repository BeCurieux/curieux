"use client";

import { Sparkles } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { MyPlaceOffer } from "@/lib/domain/place-offers";
import type { FormState } from "@/lib/forms";
import { answerOffer } from "@/lib/wishes/actions";

// A place the school is holding for a child, at a time the family asked
// for (M8c): "Yes, enrol" or "No thanks".
export function PlaceOfferCard({
  offer,
  when,
  until,
}: {
  offer: MyPlaceOffer;
  when: string;
  until: string;
}) {
  const [yes, yesAction, accepting] = useActionState(
    answerOffer.bind(null, offer.id, true),
    {} as FormState,
  );
  const [no, noAction, declining] = useActionState(
    answerOffer.bind(null, offer.id, false),
    {} as FormState,
  );
  const message = yes.error ?? no.error;
  const busy = accepting || declining;
  return (
    <section
      aria-label={`A place for ${offer.childName}`}
      className="flex flex-col gap-4 rounded-lg bg-ink p-5 text-white"
    >
      <div className="flex items-start gap-3">
        <Sparkles aria-hidden className="mt-1 size-6 shrink-0 text-butter" />
        <div>
          <p className="text-lg font-semibold">
            A place for {offer.childName} at the time you asked for
          </p>
          <p className="text-white/75">
            {when} · {offer.level} · {offer.location}
          </p>
          <p className="text-sm text-white/75">
            {offer.school} is holding it for you until {until}.
          </p>
        </div>
      </div>
      {message ? (
        <p role="alert" className="rounded-md bg-[#fff0ec] px-4 py-3 font-semibold text-[#9c3b29]">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <form action={yesAction} className="sm:flex-1">
          <Button type="submit" variant="warm" size="lg" className="w-full" disabled={busy}>
            {accepting ? "Enrolling…" : `Yes, enrol ${offer.childName}`}
          </Button>
        </form>
        <form action={noAction} className="sm:flex-1">
          <Button
            type="submit"
            variant="ghost"
            size="lg"
            className="w-full text-white hover:bg-white/10"
            disabled={busy}
          >
            {declining ? "Saying no…" : "No thanks"}
          </Button>
        </form>
      </div>
    </section>
  );
}
