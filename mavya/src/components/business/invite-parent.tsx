"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { FormShell } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { inviteParent, revokeInvite, type InviteState } from "@/lib/business/actions";
import type { FormState } from "@/lib/forms";

// The owner invites a parent and gets a link to send them. Ovyko emails it
// itself once email arrives (M6c).
export function InviteParentForm({
  familyId,
  defaultEmail,
}: {
  familyId: string;
  defaultEmail: string | null;
}) {
  const [state, action, pending] = useActionState(inviteParent, {} as InviteState);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  // Only after the action runs, so always in the browser.
  const link = state.code ? `${window.location.origin}/join/${state.code}` : null;
  const copied = copiedCode !== null && copiedCode === state.code;

  return (
    <div className="flex flex-col gap-4">
      <FormShell
        action={action}
        state={{ error: state.error, fieldErrors: state.fieldErrors }}
        pending={pending}
        submitLabel="Make an invite link"
        pendingLabel="Making…"
      >
        <input type="hidden" name="familyId" value={familyId} />
        <TextField
          name="email"
          label="Parent's email"
          type="email"
          defaultValue={state.email ?? defaultEmail ?? ""}
          hint="They'll join with this email. The link works once, for 14 days."
        />
      </FormShell>
      {link ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border-2 border-ink bg-surface p-5"
        >
          <p className="font-semibold">
            {state.emailed
              ? `Emailed to ${state.email}. You can also send the link yourself; it's only shown now.`
              : `Send this link to ${state.email} by email or text. It's only shown now.`}
          </p>
          <p className="rounded-md bg-surface-soft px-4 py-3 font-mono text-sm break-all">{link}</p>
          <Button
            type="button"
            variant="soft"
            className="w-fit"
            onClick={async () => {
              await navigator.clipboard.writeText(link);
              setCopiedCode(state.code ?? null);
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function RevokeInviteButton({ inviteId, familyId }: { inviteId: string; familyId: string }) {
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => setState(await revokeInvite(inviteId, familyId)))}
      >
        {pending ? "Cancelling…" : "Cancel invite"}
      </Button>
      {state.error ? (
        <span role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </span>
      ) : null}
    </span>
  );
}
