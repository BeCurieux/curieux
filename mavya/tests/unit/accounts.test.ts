import { describe, expect, it } from "vitest";
import { balanceOf, balanceWords, formatMoney, type AccountLine } from "@/lib/domain/accounts";

// Family accounts' money in words (docs/M7_PAYMENTS.md, M7a).

describe("money", () => {
  it("shows dollars, with cents only when there are some", () => {
    expect(formatMoney(25000)).toBe("$250");
    expect(formatMoney(123456)).toBe("$1,234.56");
    expect(formatMoney(-5050)).toBe("-$50.50");
  });

  it("says what a balance means", () => {
    expect(balanceWords(23000)).toBe("$230 owing");
    expect(balanceWords(-1000)).toBe("$10 in credit");
    expect(balanceWords(0)).toBe("Paid up");
  });

  it("adds up the lines, cancellations included", () => {
    const line = (amountCents: number) => ({ amountCents }) as AccountLine;
    expect(balanceOf([line(25000), line(-5000), line(1500), line(-1500)])).toBe(20000);
  });
});

describe("receipts", () => {
  it("say who was paid, how much and how, without naming a child", async () => {
    const messages = await import("@/lib/email/messages");
    const r = messages.paymentReceipt({
      school: "Aqua House",
      amount: "$230",
      method: "Card",
      paidOn: "Mon 5 Oct",
      reference: "AB12CD34",
      url: "https://app.ovyko.com.au/family/fees",
    });
    expect(r.subject).toBe("Receipt from Aqua House");
    expect(r.text).toContain("Aqua House has received your payment of $230.");
    expect(r.text).toContain("Paid Mon 5 Oct, by card. Reference: AB12CD34.");
    expect(r.html).toContain('href="https://app.ovyko.com.au/family/fees"');
  });
});
