import {
  CATEGORIES,
  FULFILMENT,
  FULFILMENT_LABELS,
  STAGES,
  STAGE_LABELS,
  type ProfileFacts,
} from "@/lib/domain/profile";
import { Field, describedBy } from "@/components/ui/field";

// The business profile questions. Used by onboarding (in steps) and the
// edit page (all at once). Grouped so onboarding can show one group at a time.

type Errors = Record<string, string> | undefined;

function Text({
  name,
  label,
  hint,
  errors,
  defaults,
  optional,
  textarea,
  placeholder,
  type = "text",
  autoComplete,
}: {
  name: keyof ProfileFacts;
  label: string;
  hint?: string;
  errors: Errors;
  defaults?: Partial<ProfileFacts>;
  optional?: boolean;
  textarea?: boolean;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
}) {
  const error = errors?.[name];
  const raw = defaults?.[name];
  const value = Array.isArray(raw) ? raw.join("\n") : (raw ?? "");
  const common = {
    id: name,
    name,
    defaultValue: String(value),
    placeholder,
    className: "field-input",
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy(name, hint, error),
    required: !optional,
  };
  return (
    <Field id={name} label={label} hint={hint} error={error} optional={optional}>
      {textarea ? (
        <textarea rows={3} {...common} />
      ) : (
        <input type={type} autoComplete={autoComplete} {...common} />
      )}
    </Field>
  );
}

export function BusinessFields({
  errors,
  defaults,
}: {
  errors: Errors;
  defaults?: Partial<ProfileFacts>;
}) {
  return (
    <div className="space-y-6">
      <Text
        name="brandName"
        label="Brand name"
        errors={errors}
        defaults={defaults}
        autoComplete="organization"
        placeholder="e.g. Juniper & Thread"
      />
      <Field id="category" label="What kind of business is it?" error={errors?.category}>
        <select
          id="category"
          name="category"
          defaultValue={defaults?.category ?? ""}
          required
          className="field-input"
          aria-invalid={Boolean(errors?.category)}
        >
          <option value="" disabled>
            Choose one
          </option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Text
        name="productsSummary"
        label="What do you sell?"
        hint="In a sentence, the way you'd tell a friend."
        textarea
        errors={errors}
        defaults={defaults}
        placeholder="Linen aprons and kitchen textiles"
      />
      <fieldset className="space-y-2">
        <legend className="text-ink text-sm font-semibold">How does it reach customers?</legend>
        {FULFILMENT.map((f) => (
          <label
            key={f}
            className="border-line bg-paper flex min-h-11 items-center gap-3 rounded-xl border px-4"
          >
            <input
              type="radio"
              name="fulfilment"
              value={f}
              defaultChecked={(defaults?.fulfilment ?? "physical") === f}
              className="accent-oxblood size-4"
            />
            <span>{FULFILMENT_LABELS[f]}</span>
          </label>
        ))}
      </fieldset>
      <Field id="stage" label="Where are you up to?" error={errors?.stage}>
        <select
          id="stage"
          name="stage"
          defaultValue={defaults?.stage ?? "prelaunch"}
          className="field-input"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Text
        name="websiteUrl"
        label="Website"
        type="url"
        optional
        errors={errors}
        defaults={defaults}
        placeholder="https://"
        autoComplete="url"
      />
    </div>
  );
}

export function CustomerFields({
  errors,
  defaults,
}: {
  errors: Errors;
  defaults?: Partial<ProfileFacts>;
}) {
  return (
    <div className="space-y-6">
      <Text
        name="audience"
        label="Who is your customer?"
        hint="Her situation, what she wants, what's in her way."
        textarea
        errors={errors}
        defaults={defaults}
        placeholder="New mums who want a calm, practical home…"
      />
      <Text
        name="goal"
        label="Your main goal right now"
        optional
        textarea
        errors={errors}
        defaults={defaults}
        placeholder="Launch by March with 10 products"
      />
    </div>
  );
}

export function StyleFields({
  errors,
  defaults,
}: {
  errors: Errors;
  defaults?: Partial<ProfileFacts>;
}) {
  return (
    <div className="space-y-6">
      <Text
        name="personality"
        label="Brand personality"
        hint="Three to five words. Warm? Witty? Bold? Calm?"
        optional
        errors={errors}
        defaults={defaults}
        placeholder="warm, witty, calm"
      />
      <Text
        name="visualStyle"
        label="Visual style"
        optional
        errors={errors}
        defaults={defaults}
        placeholder="earthy and minimal, lots of natural light"
      />
      <Text
        name="colours"
        label="Colours you love"
        hint="Names or hex codes."
        optional
        errors={errors}
        defaults={defaults}
        placeholder="sage, cream, #632B39"
      />
    </div>
  );
}

export function PracticalFields({
  errors,
  defaults,
}: {
  errors: Errors;
  defaults?: Partial<ProfileFacts>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Text
          name="market"
          label="Country you sell in"
          errors={errors}
          defaults={defaults}
          placeholder="Australia"
          autoComplete="country-name"
        />
        <Text
          name="currency"
          label="Currency"
          hint="Three letters, e.g. AUD, USD, GBP."
          errors={errors}
          defaults={defaults ?? { currency: "USD" }}
        />
      </div>
      <Text
        name="verifiedClaims"
        label="Facts you can stand behind"
        hint="One per line. Only things you can prove — e.g. “100% linen”, “made in Melbourne”. Empire Studio will only claim what's here."
        optional
        textarea
        errors={errors}
        defaults={defaults}
      />
      <Text
        name="prohibitedClaims"
        label="Things never to say"
        hint="One per line. We'll warn you if they ever show up."
        optional
        textarea
        errors={errors}
        defaults={defaults}
      />
    </div>
  );
}
