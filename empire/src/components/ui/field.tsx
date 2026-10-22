import type { ReactNode } from "react";

// A labelled form field. Errors are tied to the input with aria-describedby
// so screen readers announce them.

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-charcoal block text-sm font-semibold">
        {label}
        {optional ? <span className="text-mute ml-2 font-normal">optional</span> : null}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-mute text-sm">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-danger text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, hint?: unknown, error?: unknown) {
  return (
    [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") ||
    undefined
  );
}
