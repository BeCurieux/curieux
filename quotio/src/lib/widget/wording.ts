// The widget's own buttons, as words the author can change.
//
// Everything else a visitor reads is already the author's: the questions, the
// answers, the result, the lead form's heading and its small print. These four
// were the last strings still speaking in our voice on somebody else's website
// — and the one that matters, the button at the end, is the conversion moment.
// "Get my quote" is a better button than "Send it over" for most businesses,
// and only the business knows which.
//
// Two rules hold the feature together:
//
// 1. Blank means "use ours". An author who clears the field gets the default
//    back, never a button with no text on it. Enforced in `wording()` below,
//    which is the only way these strings should ever be read.
//
// 2. The defaults live here and nowhere else. The runtime falls back to them
//    and the builder shows them as placeholders, so what the panel promises
//    and what the widget renders cannot drift apart.

/** Where the lead form sits, which changes what two of the buttons should say. */
export type LeadVariant = "before" | "after" | "none";

export interface WidgetWording {
  next?: string;
  finish?: string;
  leadSubmit?: string;
  leadSkip?: string;
}

/**
 * What each button says when the author hasn't said otherwise.
 *
 * The lead buttons depend on when the form appears: asking before the result
 * means the button leads to the result ("See my result"), asking after means
 * it sends something ("Send it over"). Same for the way out — "Skip this"
 * before you've seen anything, "No thanks" once you have.
 */
export function wordingDefaults(leadVariant: LeadVariant): Required<WidgetWording> {
  const before = leadVariant === "before";
  return {
    next: "Continue",
    finish: "See my result",
    leadSubmit: before ? "See my result" : "Send it over",
    leadSkip: before ? "Skip this" : "No thanks",
  };
}

/**
 * The label to render: the author's, if they gave one worth showing.
 *
 * `trim()` rather than a plain truthiness check, because "   " is a cleared
 * field as far as anyone looking at the widget is concerned.
 */
export function wording(override: string | undefined, fallback: string): string {
  return override?.trim() || fallback;
}

/**
 * Apply an edit from the builder, dropping any override that has been emptied.
 *
 * The other half of rule 1. `wording()` makes a blank field *render* our
 * default; this makes it *stored* as no override at all, so a document carries
 * only what its author actually changed. Without it, clearing a field leaves
 * `{ next: "" }` behind — a customisation the widget then ignores, which is a
 * confusing thing to find in a document later.
 */
export function mergeWording(current: WidgetWording, next: Partial<WidgetWording>): WidgetWording {
  const merged: Record<string, string | undefined> = { ...current, ...next };
  for (const key of Object.keys(merged)) {
    if (!merged[key]?.trim()) delete merged[key];
  }
  return merged as WidgetWording;
}
