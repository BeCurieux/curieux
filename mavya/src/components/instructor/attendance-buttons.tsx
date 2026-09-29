"use client";

import { Check, X } from "lucide-react";
import { useActionState, useOptimistic } from "react";
import type { FormState } from "@/lib/forms";
import { markAttendance } from "@/lib/instructor/actions";
import { cn } from "@/lib/utils";

type Mark = "present" | "absent";

// The here/away pair for one child. The tap shows straight away; the server
// has the final say, and any refusal is shown under the child's name.
export function AttendanceButtons({
  occurrenceId,
  childId,
  name,
  status,
}: {
  occurrenceId: string;
  childId: string;
  name: string;
  status: Mark | null;
}) {
  const [shown, show] = useOptimistic<Mark | null, Mark>(status, (_, next) => next);
  const [state, mark] = useActionState(async (_: FormState, value: Mark) => {
    show(value);
    return markAttendance(occurrenceId, childId, value);
  }, {});

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {(["present", "absent"] as const).map((value) => {
          const on = shown === value;
          const Icon = value === "present" ? Check : X;
          return (
            <form key={value} action={() => mark(value)}>
              <button
                type="submit"
                aria-pressed={on}
                aria-label={`Mark ${name} ${value === "present" ? "here" : "away"}`}
                className={cn(
                  "grid size-14 place-items-center rounded-md border-2 transition active:scale-95 md:size-16 [&_svg]:size-7",
                  on && value === "present" && "border-success bg-success text-white",
                  on && value === "absent" && "border-danger bg-danger text-white",
                  !on && "border-line bg-surface text-muted hover:border-ink hover:text-ink",
                )}
              >
                <Icon aria-hidden strokeWidth={3} />
              </button>
            </form>
          );
        })}
      </div>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
