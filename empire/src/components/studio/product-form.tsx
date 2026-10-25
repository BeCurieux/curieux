"use client";

import { createProductAction, updateProductAction, type FormState } from "@/app/studio/actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, describedBy } from "@/components/ui/field";
import { useFormAction } from "@/components/ui/use-form-action";
import type { ProductInput } from "@/lib/domain/product";

type Key = keyof ProductInput;

const FIELDS: {
  name: Key;
  label: string;
  hint?: string;
  textarea?: boolean;
  required?: boolean;
  type?: string;
}[] = [
  { name: "name", label: "Product name", required: true },
  { name: "category", label: "Product type", hint: "e.g. apron, candle, planner printable" },
  { name: "price", label: "Price", hint: "Numbers only, in your store currency.", type: "number" },
  {
    name: "materials",
    label: "Materials, ingredients or what's included",
    hint: "Only what you know is true.",
    textarea: true,
  },
  { name: "dimensions", label: "Size or dimensions" },
  { name: "colourOptions", label: "Colour options" },
  {
    name: "benefits",
    label: "What it does for the customer",
    hint: "Separate with commas: deep pockets, adjustable strap",
    textarea: true,
  },
  { name: "intendedUse", label: "What it's for", hint: "When and how she'll use it." },
  { name: "customerProblem", label: "The problem it solves", textarea: true },
  { name: "careInstructions", label: "Care instructions" },
  {
    name: "shippingInfo",
    label: "Shipping or delivery",
    hint: "Only what you've actually set up. Leave blank if unsure — we'll flag it.",
    textarea: true,
  },
  {
    name: "verifiedClaims",
    label: "Facts you can prove",
    hint: "One per line, e.g. “OEKO-TEX certified”. Anything not here won't be claimed.",
    textarea: true,
  },
  {
    name: "imageNotes",
    label: "What's in your photos",
    hint: "Describe your real photos: colours, angle, props. Photo briefs describe only what's here.",
    textarea: true,
  },
];

export function ProductForm({
  profileId,
  productId,
  defaults,
}: {
  profileId: string;
  productId?: string;
  defaults?: ProductInput;
}) {
  const action = productId
    ? updateProductAction.bind(null, productId)
    : createProductAction.bind(null, profileId);
  const { state, onSubmit, pending } = useFormAction<FormState>(action, {});
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {state.message ? (
        <Notice tone={state.ok ? "success" : "danger"}>{state.message}</Notice>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const id = `p-${f.name}`;
          const error = state.errors?.[f.name];
          const raw = defaults?.[f.name];
          const value = Array.isArray(raw)
            ? raw.join("\n")
            : raw === null || raw === undefined
              ? ""
              : String(raw);
          const common = {
            id,
            name: f.name,
            defaultValue: value,
            required: f.required,
            className: "field-input",
            "aria-invalid": Boolean(error),
            "aria-describedby": describedBy(id, f.hint, error),
          };
          return (
            <div key={f.name} className={f.textarea ? "sm:col-span-2" : ""}>
              <Field id={id} label={f.label} hint={f.hint} error={error} optional={!f.required}>
                {f.textarea ? (
                  <textarea rows={3} {...common} />
                ) : (
                  <input
                    type={f.type ?? "text"}
                    step={f.type === "number" ? "0.01" : undefined}
                    min={f.type === "number" ? 0 : undefined}
                    {...common}
                  />
                )}
              </Field>
            </div>
          );
        })}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : productId ? "Save product" : "Add product"}
      </Button>
    </form>
  );
}
