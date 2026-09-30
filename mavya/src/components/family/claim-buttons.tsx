"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { claimOffer, declineOffer } from "@/lib/family/actions";
import type { FormState } from "@/lib/forms";

// "Claim this spot" or "No thanks". A claim that comes too late (someone
// else got there first, or it expired) says so here.
export function ClaimButtons({ code, child }: { code: string; child: string }) {
  const [claim, claimAction, claiming] = useActionState(
    claimOffer.bind(null, code),
    {} as FormState,
  );
  const [decline, declineAction, declining] = useActionState(
    declineOffer.bind(null, code),
    {} as FormState,
  );
  const message = claim.error ?? decline.error;
  if (decline.ok)
    return (
      <p role="status" className="rounded-md bg-surface-soft px-4 py-3 font-semibold">
        {decline.ok}
      </p>
    );
  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p role="alert" className="rounded-md bg-[#fff0ec] px-4 py-3 font-semibold text-[#9c3b29]">
          {message}
        </p>
      ) : null}
      <form action={claimAction}>
        <Button
          type="submit"
          variant="warm"
          size="lg"
          className="w-full"
          disabled={claiming || declining}
        >
          {claiming ? "Booking…" : `Claim this spot for ${child}`}
        </Button>
      </form>
      <form action={declineAction}>
        <Button
          type="submit"
          variant="ghost"
          size="lg"
          className="w-full"
          disabled={claiming || declining}
        >
          No thanks
        </Button>
      </form>
    </div>
  );
}
