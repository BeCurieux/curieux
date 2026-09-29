"use client";

import { useId, type ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useFieldError } from "./action-form";

const control =
  "h-12 w-full rounded-sm border border-line bg-surface px-4 text-base text-ink placeholder:text-muted focus-visible:border-cobalt aria-invalid:border-danger";

function Wrapper({
  name,
  label,
  hint,
  optional,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
  children: (props: { id: string; invalid: boolean; describedBy?: string }) => ReactNode;
}) {
  const error = useFieldError(name);
  // useId, not the field name: several forms on one page can share a name.
  const id = `field-${useId()}`;
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {label} {optional ? <span className="font-normal text-muted">(optional)</span> : null}
      </Label>
      {children({ id, invalid: Boolean(error), describedBy })}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  name,
  label,
  hint,
  optional,
  defaultValue,
  type = "text",
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
  defaultValue?: string | number | null;
  type?: string;
  autoComplete?: string;
  inputMode?: "text" | "email" | "tel" | "numeric";
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <Wrapper name={name} label={label} hint={hint} optional={optional}>
      {({ id, invalid, describedBy }) => (
        <input
          id={id}
          name={name}
          type={type}
          defaultValue={defaultValue ?? undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={control}
          {...rest}
        />
      )}
    </Wrapper>
  );
}

export function SelectField({
  name,
  label,
  hint,
  optional,
  defaultValue,
  options,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  optional?: boolean;
  defaultValue?: string | number | null;
  options: { value: string; label: string; group?: string }[];
  placeholder?: string;
}) {
  const groups = [...new Set(options.map((o) => o.group ?? ""))];
  return (
    <Wrapper name={name} label={label} hint={hint} optional={optional}>
      {({ id, invalid, describedBy }) => (
        <select
          id={id}
          name={name}
          defaultValue={defaultValue ?? ""}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            control,
            "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%231f2230%22 stroke-width=%222%22 fill=%22none%22/></svg>')] appearance-none bg-[position:right_16px_center] bg-no-repeat pr-10",
          )}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {groups.map((group) =>
            group ? (
              <optgroup key={group} label={group}>
                {options
                  .filter((o) => o.group === group)
                  .map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
              </optgroup>
            ) : (
              options
                .filter((o) => !o.group)
                .map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))
            ),
          )}
        </select>
      )}
    </Wrapper>
  );
}
