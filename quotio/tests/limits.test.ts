import { beforeEach, describe, expect, it, vi } from "vitest";
import { interactionLimit, ORDERED_PLANS, widgetLimit } from "@/lib/plans";

const countInteractionsThisMonth = vi.fn<(ownerId: string) => Promise<number>>();

vi.mock("@/lib/db/store", () => ({
  getStore: () => ({ countInteractionsThisMonth }),
  uniqueSlug: vi.fn(),
}));

const { isOverInteractionLimit } = await import("@/lib/widgets/service");

/**
 * The monthly interaction limit was displayed for a while before anything
 * enforced it — a bar filling towards a number that meant nothing. These
 * tests are about the boundary, because an off-by-one here either pauses
 * someone a visitor early or lets the plan be exceeded forever.
 */
describe("the monthly interaction limit", () => {
  beforeEach(() => countInteractionsThisMonth.mockReset());

  const at = (used: number) => {
    countInteractionsThisMonth.mockResolvedValue(used);
    return isOverInteractionLimit("u_1", "free");
  };

  const free = interactionLimit("free");

  it("lets the last allowed interaction through", async () => {
    // 499 used means the 500th visitor still gets a widget.
    await expect(at(free - 1)).resolves.toBe(false);
  });

  it("pauses once the allowance is spent, not before", async () => {
    await expect(at(free)).resolves.toBe(true);
  });

  it("stays paused if the count somehow ran past the limit", async () => {
    await expect(at(free * 3)).resolves.toBe(true);
  });

  it("is not tripped by a widget nobody has used", async () => {
    await expect(at(0)).resolves.toBe(false);
  });

  it("gives each plan its own ceiling", async () => {
    countInteractionsThisMonth.mockResolvedValue(free);
    // The same usage that pauses a free account is nowhere near a paid one.
    await expect(isOverInteractionLimit("u_1", "free")).resolves.toBe(true);
    await expect(isOverInteractionLimit("u_1", "pro")).resolves.toBe(false);
    await expect(isOverInteractionLimit("u_1", "business")).resolves.toBe(false);
  });
});

describe("the published limits", () => {
  it("only ever go up as you pay more", () => {
    // A plan that cost more but allowed less would be a pricing page that
    // lies, and the pricing page is generated from exactly these numbers.
    const paid = [...ORDERED_PLANS].sort((a, b) => a.price - b.price);
    for (let index = 1; index < paid.length; index += 1) {
      const [previous, current] = [paid[index - 1], paid[index]];
      expect(widgetLimit(current.id), current.id).toBeGreaterThan(widgetLimit(previous.id));
      expect(interactionLimit(current.id), current.id).toBeGreaterThan(
        interactionLimit(previous.id)
      );
    }
  });
});
