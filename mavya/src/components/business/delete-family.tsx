"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteFamily, type DeleteFamilyState } from "@/lib/business/actions";

export function DeleteFamilyForm({ familyId, name }: { familyId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteFamily, {} as DeleteFamilyState);
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="familyId" value={familyId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Type {name} to confirm</Label>
        <Input
          id="confirm"
          name="confirm"
          autoComplete="off"
          defaultValue={state.confirm}
          aria-invalid={state.error ? true : undefined}
        />
      </div>
      {state.error ? (
        <p role="alert" className="rounded-md bg-[#fff0ec] px-4 py-3 font-semibold text-[#9c3b29]">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        className="w-fit bg-[#9c3b29] [--lip:#5e2016] hover:bg-[#7a2c1f]"
      >
        {pending ? "Deleting…" : "Delete this family for good"}
      </Button>
    </form>
  );
}
