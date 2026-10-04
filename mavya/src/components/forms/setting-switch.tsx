"use client";

import { useState, useTransition } from "react";
import type { FormState } from "@/lib/forms";

// An owner's on/off choice, saved as soon as it's flipped.
export function SettingSwitch({
  on,
  title,
  children,
  save,
}: {
  on: boolean;
  title: string;
  children: React.ReactNode;
  save: (on: boolean) => Promise<FormState>;
}) {
  const [value, setValue] = useState(on);
  const [state, setState] = useState<FormState>({});
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface px-5 py-4">
      <label className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-lg font-semibold">{title}</span>
          <span className="block text-sm text-muted">{children}</span>
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
              const result = await save(next);
              setState(result);
              if (result.error) setValue(!next);
            });
          }}
          className="h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition before:block before:size-6 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition checked:bg-ink checked:before:translate-x-5"
        />
      </label>
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
    </div>
  );
}
