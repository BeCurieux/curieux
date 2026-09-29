"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { removeStaffMember, restoreStaffMember } from "@/lib/business/actions";
import type { FormState } from "@/lib/forms";

function Message({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="rounded-md bg-[#fff0ec] px-4 py-3 font-semibold text-[#9c3b29]">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="rounded-md bg-[#dcf1e7] px-4 py-3 font-semibold text-[#1d5a41]">
        {state.ok}
      </p>
    );
  return null;
}

// Removing access asks once more, and says exactly what will happen.
export function RemoveAccess({
  membershipId,
  name,
  classCount,
}: {
  membershipId: string;
  name: string;
  classCount: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(
    () => removeStaffMember(membershipId),
    {} as FormState,
  );

  if (!confirming)
    return (
      <div className="flex flex-col gap-3">
        <Message state={state} />
        <Button variant="soft" className="w-fit" onClick={() => setConfirming(true)}>
          Remove access
        </Button>
      </div>
    );

  return (
    <form action={action} className="flex flex-col gap-3 rounded-md bg-[#fff0ec] p-4">
      <p className="font-semibold text-[#9c3b29]">
        Remove {name}&rsquo;s access now? They&rsquo;ll be signed out straight away
        {classCount > 0
          ? ` and their ${classCount === 1 ? "class" : `${classCount} classes`} will need a new instructor.`
          : "."}
      </p>
      <Message state={state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Removing…" : `Remove ${name}`}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function RestoreAccess({ membershipId, name }: { membershipId: string; name: string }) {
  const [state, action, pending] = useActionState(
    () => restoreStaffMember(membershipId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <Message state={state} />
      <Button type="submit" variant="soft" className="w-fit" disabled={pending}>
        {pending ? "Restoring…" : `Give ${name} access again`}
      </Button>
    </form>
  );
}
