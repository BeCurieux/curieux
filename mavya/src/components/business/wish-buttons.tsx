"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { FormState } from "@/lib/forms";
import { placeChild } from "@/lib/wishes/actions";

// Enrolling a child from their family's request (M8b).
export function PlaceButton({
  wishId,
  classId,
  label,
}: {
  wishId: string;
  classId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    placeChild.bind(null, wishId, classId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-1">
      <Button type="submit" size="sm" disabled={pending || Boolean(state.ok)} className="w-fit">
        {pending ? "Enrolling…" : label}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm font-semibold text-[#23694c]">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
