import type { ModuleKey } from "@/lib/domain/modules";
import type { AIProvider, GenerationInput, GenerationResult } from "../provider";
import { mockBrandBlueprint } from "./brand";
import { mockEmailSequence, mockSocialContent } from "./marketing";
import { mockImageBriefs, mockProductListing } from "./product";
import { mockHomepageCopy, mockThemeBrief, mockThemePrompts } from "./theme";

// The offline generator: deterministic, free, and built only from what the
// customer entered. It runs in development, tests, demos, and any deployment
// without an AI key, so the whole studio can be tried without spending.

export class MockProvider implements AIProvider {
  readonly name = "mock" as const;

  async generate<M extends ModuleKey>(input: GenerationInput<M>): Promise<GenerationResult<M>> {
    const { profile, product, products } = input;
    const needProduct = () => {
      if (!product) throw new Error("this module needs a product");
      return product;
    };
    const output = (() => {
      switch (input.module) {
        case "brand_blueprint":
          return mockBrandBlueprint(profile);
        case "theme_brief":
          return mockThemeBrief(profile, products);
        case "theme_prompts":
          return mockThemePrompts(profile, products, Boolean(input.options.sampleOnly));
        case "homepage_copy":
          return mockHomepageCopy(profile, products);
        case "product_listing":
          return mockProductListing(profile, needProduct());
        case "image_briefs":
          return mockImageBriefs(profile, needProduct());
        case "email_sequence":
          return mockEmailSequence(profile, products);
        case "social_content":
          return mockSocialContent(profile, products);
        default:
          throw new Error(`unknown module ${input.module satisfies never}`);
      }
    })();
    return { output, model: "mock-1", usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
