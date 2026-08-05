// Design system templates (brief §16).
// A small, constrained set of layouts. The editor lets parents pick between
// compatible templates for a page — it never allows free-form dragging.

export interface PageTemplate {
  id: string;
  name: string;
  photoSlots: number;
  textSlots: number;
  /** which photo aspect ratios this layout suits: w/h ranges */
  suitsAspect?: { min: number; max: number };
}

export const TEMPLATES: PageTemplate[] = [
  { id: "full_bleed_photo",     name: "Full bleed photo",      photoSlots: 1, textSlots: 0, suitsAspect: { min: 0.6, max: 1.6 } },
  { id: "single_photo_caption", name: "Photo with caption",    photoSlots: 1, textSlots: 1 },
  { id: "two_photo",            name: "Two photos",            photoSlots: 2, textSlots: 1 },
  { id: "three_photo",          name: "Three photos",          photoSlots: 3, textSlots: 1 },
  { id: "quote_page",           name: "Quote",                 photoSlots: 0, textSlots: 1 },
  { id: "little_things_grid",   name: "The little things",     photoSlots: 0, textSlots: 8 },
  { id: "chapter_opener",       name: "Chapter opener",        photoSlots: 1, textSlots: 2 },
  { id: "portrait_plus_text",   name: "Portrait and story",    photoSlots: 1, textSlots: 1, suitsAspect: { min: 0.5, max: 0.95 } },
  { id: "timeline",             name: "Timeline",              photoSlots: 4, textSlots: 4 },
  { id: "before_after",         name: "Then and now",          photoSlots: 2, textSlots: 2 },
  { id: "closing_page",         name: "Closing",               photoSlots: 1, textSlots: 1 },
];

export function getTemplate(id: string): PageTemplate {
  const t = TEMPLATES.find((t) => t.id === id);
  if (!t) throw new Error(`unknown template: ${id}`);
  return t;
}

/** Templates a page can be swapped to without losing content. */
export function compatibleTemplates(templateId: string): PageTemplate[] {
  const current = getTemplate(templateId);
  return TEMPLATES.filter(
    (t) => t.photoSlots === current.photoSlots && t.textSlots >= Math.min(current.textSlots, 1)
  );
}

/**
 * Pick a photo layout responsive to image aspect ratio (§16).
 * Landscape-heavy → full bleed; portrait → portrait_plus_text; else captioned.
 */
export function pickPhotoTemplate(width: number | null, height: number | null): string {
  if (!width || !height) return "single_photo_caption";
  const aspect = width / height;
  if (aspect < 0.95) return "portrait_plus_text";
  if (aspect >= 1.2 && aspect <= 1.6) return "full_bleed_photo";
  return "single_photo_caption";
}
