"use client";

import { useActionState, useState, useTransition } from "react";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import {
  askFamilies,
  deleteTerm,
  offerTermMove,
  prepareTermAsks,
  recordTermAnswer,
  remindTermFamilies,
  saveTerm,
  setLessonsInTermOnly,
} from "@/lib/business/actions";
import type { Answer, Term } from "@/lib/domain/terms";
import type { FormState } from "@/lib/forms";

// Owners' term forms (M6e).

export function TermForm({ term }: { term?: Term }) {
  return (
    <ActionForm
      action={saveTerm.bind(null, term?.id ?? null)}
      submitLabel={term ? "Save term" : "Add term"}
    >
      <TextField
        name="name"
        label="Name"
        hint="As families know it, like Term 1 2027."
        defaultValue={term?.name}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField name="startsOn" label="First day" type="date" defaultValue={term?.startsOn} />
        <TextField name="endsOn" label="Last day" type="date" defaultValue={term?.endsOn} />
      </div>
    </ActionForm>
  );
}

function Note({ state }: { state: FormState }) {
  if (state.error)
    return (
      <p role="alert" className="text-sm font-semibold text-danger">
        {state.error}
      </p>
    );
  if (state.ok)
    return (
      <p role="status" className="text-sm font-semibold text-[#23694c]">
        {state.ok}
      </p>
    );
  return null;
}

// Lessons all year, or only during terms.
export function TermOnlySwitch({ on }: { on: boolean }) {
  const [value, setValue] = useState(on);
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-5 py-4">
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-lg font-semibold">Lessons only during terms</span>
          <span className="block text-sm text-muted">
            On: no lessons in the school holidays. Off: lessons all year, and terms only mark when
            families confirm their place.
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={value}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setValue(next);
            start(async () => {
              const result = await setLessonsInTermOnly(next);
              setState(result);
              if (result.error) setValue(!next);
            });
          }}
          className="h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition before:block before:size-6 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition checked:bg-ink checked:before:translate-x-5"
        />
      </label>
      <Note state={state} />
    </div>
  );
}

export function DeleteTermButton({ termId }: { termId: string }) {
  const [state, action, pending] = useActionState(deleteTerm.bind(null, termId), {} as FormState);
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant="ghost" disabled={pending} className="w-fit">
        {pending ? "Removing…" : "Remove this term"}
      </Button>
      <Note state={state} />
    </form>
  );
}

export function PrepareButton({ termId }: { termId: string }) {
  const [state, action, pending] = useActionState(
    prepareTermAsks.bind(null, termId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Getting ready…" : "Get ready to ask families"}
      </Button>
      <Note state={state} />
    </form>
  );
}

export function AskFamiliesForm({
  termId,
  replyBy,
  asked,
}: {
  termId: string;
  replyBy: string;
  asked: boolean;
}) {
  return (
    <ActionForm
      action={askFamilies.bind(null, termId)}
      submitLabel={asked ? "Ask children added since" : "Ask families"}
      pendingLabel="Asking…"
      variant="warm"
    >
      <TextField
        name="replyBy"
        label="Reply by"
        type="date"
        hint="Families who haven't answered by then keep their place."
        defaultValue={replyBy}
      />
    </ActionForm>
  );
}

export function RemindButton({ termId }: { termId: string }) {
  const [state, action, pending] = useActionState(
    remindTermFamilies.bind(null, termId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-2">
      <Button type="submit" variant="ghost" disabled={pending} className="w-fit">
        {pending ? "Sending…" : "Remind families who haven't answered"}
      </Button>
      <Note state={state} />
    </form>
  );
}

const select =
  "h-11 w-full min-w-0 rounded-sm border border-line bg-surface px-3 text-base text-ink focus-visible:border-cobalt";

// Offer a different class next term, or take the offer back.
export function MoveOffer({
  termId,
  askId,
  child,
  offeredClassId,
  classes,
}: {
  termId: string;
  askId: string;
  child: string;
  offeredClassId: string | null;
  classes: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(
    offerTermMove.bind(null, termId, askId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <select
          name="classId"
          defaultValue={offeredClassId ?? ""}
          aria-label={`Move ${child} next term to`}
          className={select}
        >
          <option value="">Same class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              Move to {c.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="soft" disabled={pending}>
          {pending ? "…" : "Save"}
        </Button>
      </div>
      <Note state={state} />
    </form>
  );
}

// The owner records a family's answer given in person or by phone.
export function RecordAnswer({
  termId,
  askId,
  child,
  answer,
  canMove,
}: {
  termId: string;
  askId: string;
  child: string;
  answer: Answer | null;
  canMove: boolean;
}) {
  const [state, action, pending] = useActionState(
    recordTermAnswer.bind(null, termId, askId),
    {} as FormState,
  );
  return (
    <form action={action} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <select
          name="answer"
          defaultValue={answer ?? ""}
          aria-label={`${child}'s answer`}
          className={select}
        >
          <option value="" disabled>
            Record their answer
          </option>
          <option value="stay">Staying</option>
          {canMove ? <option value="move">Moving up</option> : null}
          <option value="leave">Leaving</option>
        </select>
        <Button type="submit" size="sm" variant="soft" disabled={pending}>
          {pending ? "…" : "Save"}
        </Button>
      </div>
      <Note state={state} />
    </form>
  );
}
