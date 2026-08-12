"use client";

// The Design tab (brief §17).
//
// "Keep customisation intentionally constrained." Six presets, a colour, five
// fonts, four roundness steps, three button styles, a logo. That is the whole
// list, and there is deliberately no CSS box: the product's promise is that a
// widget is hard to make ugly, and every extra dial is a way to break it.

import { BRAND_SWATCHES, ColourField } from "./ContentTab";
import { Section, SegmentedField, SelectField, TextField, ToggleField, UpgradeNote } from "./controls";
import type { EditorProps } from "./types";
import { THEME_FONTS, THEME_PRESETS } from "@/lib/widget/themes";
import type { WidgetTheme } from "@/lib/widget/schema";

/** Themes beyond the first two are a paid perk (§35). */
const FREE_PRESETS: Array<WidgetTheme["preset"]> = ["playful", "minimal"];

export function DesignTab({ doc, update, capabilities, planName }: EditorProps) {
  const theme = doc.theme;
  const setTheme = (next: Partial<WidgetTheme>) =>
    update((draft) => ({ ...draft, theme: { ...draft.theme, ...next } }));

  return (
    <>
      <Section title="Theme" hint="A whole look in one click. Everything else fine-tunes it.">
        {capabilities.premiumThemes ? null : (
          <UpgradeNote>
            Playful and Minimal are on every plan. The other four come with Pro — you&rsquo;re on{" "}
            {planName}.
          </UpgradeNote>
        )}

        <div className="grid grid-cols-2 gap-2">
          {THEME_PRESETS.map((preset) => {
            const locked = !capabilities.premiumThemes && !FREE_PRESETS.includes(preset.id);
            const selected = theme.preset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={locked}
                title={locked ? "Available on Pro" : preset.hint}
                onClick={() => setTheme({ preset: preset.id })}
                className={`rounded-btn border p-2.5 text-left transition ${
                  selected ? "border-purple bg-purple-soft" : "border-rule hover:border-muted"
                } ${locked ? "cursor-not-allowed opacity-45" : ""}`}
              >
                <span className="flex gap-1">
                  {preset.swatch.map((colour) => (
                    <span
                      key={colour}
                      className="h-5 w-5 rounded-full"
                      style={{ background: colour, boxShadow: "inset 0 0 0 1px rgba(27,31,59,0.08)" }}
                    />
                  ))}
                </span>
                <span className="mt-2 block text-sm font-semibold">{preset.label}</span>
                {locked ? <span className="block text-[11px] font-medium text-muted">Pro</span> : null}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Your brand">
        <ColourField
          label="Brand color"
          value={theme.brandColour}
          swatches={BRAND_SWATCHES}
          // Filled buttons take the theme's ink, not this colour, so on the
          // default style you can change brand colour and watch the biggest
          // button on the result screen not move. Said here, where you'd
          // notice, and pointing at the control that changes it — the Buttons
          // field explains the same rule, but two sections further down.
          hint={
            theme.buttonStyle === "filled"
              ? "Colors the progress bar, selected answers and highlights. Filled buttons follow the theme’s ink — set Buttons to Soft or Outline below to color those too."
              : "Colors the progress bar, selected answers, highlights and your buttons."
          }
          onChange={(value) => {
            // Half-typed hex codes shouldn't repaint the preview mid-keystroke.
            if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value)) setTheme({ brandColour: value });
          }}
        />

        <SelectField
          label="Font"
          value={theme.font}
          options={Object.entries(THEME_FONTS).map(([value, font]) => ({
            value: value as WidgetTheme["font"],
            label: font.label,
          }))}
          onChange={(font) => setTheme({ font })}
        />

        <TextField
          label="Logo"
          value={theme.logoUrl ?? ""}
          maxLength={500}
          placeholder="https://yoursite.com/logo.png"
          hint="A link to your logo. It sits above the progress bar."
          onChange={(value) => setTheme({ logoUrl: value || undefined })}
        />
      </Section>

      <Section title="Shape">
        <SegmentedField
          label="Corner roundness"
          value={theme.radius}
          options={[
            { value: "s", label: "S" },
            { value: "m", label: "M" },
            { value: "l", label: "L" },
            { value: "xl", label: "XL" },
          ]}
          onChange={(radius) => setTheme({ radius })}
        />
        <SegmentedField
          label="Buttons"
          value={theme.buttonStyle}
          options={[
            { value: "filled", label: "Filled" },
            { value: "soft", label: "Soft" },
            { value: "outline", label: "Outline" },
          ]}
          onChange={(buttonStyle) => setTheme({ buttonStyle })}
          hint="Filled uses the theme's ink so it stays legible. Soft and Outline use your brand color."
        />
      </Section>

      <Section title="Layout">
        <ToggleField
          label="Show progress"
          hint="The step list on wide screens, a progress bar on phones."
          checked={doc.settings.showProgress}
          onChange={(checked) =>
            update((draft) => ({
              ...draft,
              settings: { ...draft.settings, showProgress: checked },
            }))
          }
        />
        <ToggleField
          label="Show the “Made with” badge"
          hint={
            capabilities.removeBadge
              ? "A small, unobtrusive credit under the widget."
              : `Included on ${planName}. Upgrade to remove it.`
          }
          checked={doc.settings.showBadge || !capabilities.removeBadge}
          disabled={!capabilities.removeBadge}
          onChange={(checked) =>
            update((draft) => ({
              ...draft,
              settings: { ...draft.settings, showBadge: checked },
            }))
          }
        />
      </Section>
    </>
  );
}
