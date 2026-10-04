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

describe("fee reminders and failed payments", () => {
  it("say how much and when, without naming a child", async () => {
    const messages = await import("@/lib/email/messages");
    const soon = messages.feeReminder({
      school: "Aqua House",
      stage: "soon",
      amount: "$230",
      dueOn: "Mon 2 Feb",
      url: "https://app.ovyko.com.au/family/fees",
    });
    expect(soon.subject).toBe("Fees from Aqua House");
    expect(soon.text).toContain("You have $230 to pay to Aqua House, due Mon 2 Feb.");
    const late = messages.feeReminder({
      school: "Aqua House",
      stage: "overdue",
      amount: "$230",
      dueOn: "Mon 2 Feb",
      url: "u",
    });
    expect(late.subject).toBe("Fees overdue at Aqua House");
    expect(late.text).toContain("was due to Aqua House on Mon 2 Feb");
    const failed = messages.paymentFailed({
      school: "Aqua House",
      amount: "$230",
      url: "u",
      method: "direct_debit",
      instalment: false,
    });
    expect(failed.subject).toBe("A payment didn't go through");
    expect(failed.text).toContain("Your direct debit of $230 to Aqua House didn't go through.");
    const card = messages.paymentFailed({
      school: "Aqua House",
      amount: "$115",
      url: "u",
      method: "card",
      instalment: true,
    });
    expect(card.text).toContain("Your instalment of $115 to Aqua House didn't go through.");
    expect(card.text).toContain("the rest of your instalments are cancelled");
  });
});
