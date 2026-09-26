/**
 * A deterministic classifier that costs nothing and needs no key.
 *
 * It reads the listing's words against a small keyword table. It is here so
 * the pipeline, the stores, the labelling page and the eval can all be run and
 * tested offline. It is not a baseline worth measuring, and its values are
 * stored under `mock` so they can never be mistaken for the model's.
 */

import type { ClassifierProvider, ClassifyRequest, RunResult } from "./provider";
import type { ClassifierInput } from "./inputs";
import { UNKNOWN } from "./taxonomy";

const has = (text: string, ...words: string[]) => words.some((w) => new RegExp(`\\b${w}`, "i").test(text));

export function mockClassify(input: ClassifierInput): Record<string, unknown> {
  const text = [input.title, input.productType ?? "", input.tags.join(" "), input.description].join(" ");

  const audience: string[] = [];
  if (has(text, "women", "womens", "ladies")) audience.push("women");
  if (has(text, "men", "mens")) audience.push("men");
  if (has(text, "kids", "child")) audience.push("kids");
  if (has(text, "baby", "infant")) audience.push("baby");

  const use: string[] = [];
  if (has(text, "boat", "sail", "beach", "swim", "fishing")) use.push("water_coastal");
  if (has(text, "hike", "camp", "garden", "outdoor")) use.push("outdoor");
  if (has(text, "travel", "packable")) use.push("travel");
  if (has(text, "kitchen", "home", "candle", "bed")) use.push("home");
  if (has(text, "workshop", "drill", "office", "desk")) use.push("work");

  const itemType = has(text, "set", "bundle", "kit") ? "set_bundle" : has(text, "refill", "candle", "soap") ? "consumable" : has(text, "case", "strap", "bit", "blade") ? "accessory" : "core_item";

  return {
    parent_category: has(text, "drill", "tool", "saw", "wrench") ? "tools_hardware" : has(text, "shirt", "dress", "knit", "jacket") ? "apparel" : "other",
    occasion_fit: has(text, "father") ? ["fathers_day"] : has(text, "mother") ? ["mothers_day"] : ["everyday"],
    gift_role: itemType === "accessory" ? "not_giftable" : "practical",
    use_context: use.length ? use.slice(0, 3) : [UNKNOWN],
    seasonality: has(text, "linen", "swim", "summer") ? "warm_weather" : has(text, "wool", "knit", "winter") ? "cold_weather" : "all_season",
    audience_fit: audience.length ? audience : [UNKNOWN],
    item_type: itemType,
    style_register: has(text, "heavy-duty", "tool", "drill") ? "functional" : "casual",
  };
}

export function createMockClassifier(): ClassifierProvider {
  return {
    name: "mock",
    model: "mock",
    billing: "free",
    async classify(requests: readonly ClassifyRequest[]): Promise<RunResult[]> {
      return requests.map((r) => ({ customId: r.customId, output: mockClassify(r.input), error: null, usage: null }));
    },
  };
}
