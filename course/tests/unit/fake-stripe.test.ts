import { describe, expect, it } from "vitest";
import { parseForm } from "../e2e/fake-stripe";

// The test suite's stand-in Stripe server reads the SDK's form encoding;
// if it misread it, the end-to-end checks of what we send would be wrong.
describe("fake Stripe form parsing", () => {
  it("reads nested objects and arrays the way Stripe does", () => {
    expect(
      parseForm(
        "mode=payment&line_items[0][price]=price_1&line_items[0][quantity]=1&metadata[user_id]=u1&optional_items[0][price]=price_2&lookup_keys[]=a&lookup_keys[]=b",
      ),
    ).toEqual({
      mode: "payment",
      line_items: [{ price: "price_1", quantity: "1" }],
      metadata: { user_id: "u1" },
      optional_items: [{ price: "price_2" }],
      lookup_keys: ["a", "b"],
    });
  });
});
