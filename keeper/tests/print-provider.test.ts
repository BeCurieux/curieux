import { describe, expect, it } from "vitest";
import { MockPrintProvider } from "@/lib/print/mock";
import type { CreateOrderRequest } from "@/lib/print/provider";

const orderRequest = (key: string): CreateOrderRequest => ({
  idempotencyKey: key,
  sku: "BOOK-A4-HARD-M",
  pageCount: 48,
  copies: 1,
  recipient: {
    name: "Test Parent",
    line1: "1 Example St",
    city: "Sydney",
    postcode: "2000",
    countryCode: "AU",
  },
  interiorPdfUrl: "https://signed.example/interior.pdf",
  coverPdfUrl: "https://signed.example/cover.pdf",
});

describe("print provider adapter (§19, §26)", () => {
  it("same idempotency key never creates a duplicate order", async () => {
    const provider = new MockPrintProvider();
    const first = await provider.createOrder(orderRequest("book-123"));
    const second = await provider.createOrder(orderRequest("book-123"));
    expect(second.providerOrderId).toBe(first.providerOrderId);
  });

  it("different keys create distinct orders", async () => {
    const provider = new MockPrintProvider();
    const a = await provider.createOrder(orderRequest("book-a"));
    const b = await provider.createOrder(orderRequest("book-b"));
    expect(a.providerOrderId).not.toBe(b.providerOrderId);
  });

  it("validates page counts", async () => {
    const provider = new MockPrintProvider();
    const bad = await provider.validateBook({
      sku: "x",
      pageCount: 47,
      interiorPdfBytes: 100,
      coverPdfBytes: 100,
    });
    expect(bad.valid).toBe(false);
    const good = await provider.validateBook({
      sku: "x",
      pageCount: 48,
      interiorPdfBytes: 100,
      coverPdfBytes: 100,
    });
    expect(good.valid).toBe(true);
  });

  it("quotes scale with page count and copies", async () => {
    const provider = new MockPrintProvider();
    const small = await provider.getQuote({ sku: "x", pageCount: 48, copies: 1, destinationCountryCode: "AU" });
    const large = await provider.getQuote({ sku: "x", pageCount: 80, copies: 2, destinationCountryCode: "AU" });
    expect(large.amount).toBeGreaterThan(small.amount);
  });

  it("exposes tracking only after shipping", async () => {
    const provider = new MockPrintProvider();
    const order = await provider.createOrder(orderRequest("track-1"));
    expect((await provider.getTracking(order.providerOrderId)).trackingNumber).toBeNull();
    await provider.getOrderStatus(order.providerOrderId); // → in_production
    await provider.getOrderStatus(order.providerOrderId); // → shipped
    expect((await provider.getTracking(order.providerOrderId)).trackingNumber).not.toBeNull();
  });
});
