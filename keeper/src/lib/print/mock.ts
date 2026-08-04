// Mock print provider for development, demos and tests.
// Simulates the full order lifecycle in memory, including idempotency.

import type {
  BookValidationInput, BookValidationResult, CreateOrderRequest, PrintProvider,
  PrintQuote, PrintQuoteRequest, ProviderOrder, TrackingInfo,
} from "./provider";

export class MockPrintProvider implements PrintProvider {
  readonly name = "mock";
  private orders = new Map<string, ProviderOrder>();
  private byIdempotencyKey = new Map<string, string>();
  private counter = 0;

  async getQuote(req: PrintQuoteRequest): Promise<PrintQuote> {
    const base = 24 + req.pageCount * 0.35;
    return {
      amount: Math.round(base * req.copies * 100) / 100,
      currency: "AUD",
      shippingAmount: 9.95,
      estimatedDays: 7,
    };
  }

  async validateBook(input: BookValidationInput): Promise<BookValidationResult> {
    const errors: string[] = [];
    if (input.pageCount % 2 !== 0) errors.push("page count must be even");
    if (input.pageCount < 24) errors.push("minimum 24 pages");
    if (input.interiorPdfBytes <= 0) errors.push("interior PDF is empty");
    if (input.coverPdfBytes <= 0) errors.push("cover PDF is empty");
    return { valid: errors.length === 0, errors };
  }

  async createOrder(req: CreateOrderRequest): Promise<ProviderOrder> {
    // Idempotency: same key returns the same order, never a duplicate (§26).
    const existingId = this.byIdempotencyKey.get(req.idempotencyKey);
    if (existingId) return this.orders.get(existingId)!;

    const id = `mock-order-${++this.counter}`;
    const order: ProviderOrder = {
      providerOrderId: id,
      status: "received",
      cost: { amount: 24 + req.pageCount * 0.35, currency: "AUD" },
    };
    this.orders.set(id, order);
    this.byIdempotencyKey.set(req.idempotencyKey, id);
    return order;
  }

  async getOrderStatus(providerOrderId: string): Promise<ProviderOrder> {
    const order = this.orders.get(providerOrderId);
    if (!order) throw new Error(`unknown order ${providerOrderId}`);
    // Advance one lifecycle step per poll so the UI can be demonstrated.
    order.status =
      order.status === "received" ? "in_production" :
      order.status === "in_production" ? "shipped" :
      order.status === "shipped" ? "delivered" : order.status;
    return { ...order };
  }

  async cancelOrder(providerOrderId: string): Promise<boolean> {
    const order = this.orders.get(providerOrderId);
    if (!order || order.status !== "received") return false;
    order.status = "cancelled";
    return true;
  }

  async getTracking(providerOrderId: string): Promise<TrackingInfo> {
    const order = this.orders.get(providerOrderId);
    if (!order || (order.status !== "shipped" && order.status !== "delivered")) {
      return { trackingNumber: null, trackingUrl: null, carrier: null };
    }
    return {
      trackingNumber: `MOCK${providerOrderId.replace(/\D/g, "").padStart(8, "0")}`,
      trackingUrl: `https://example.com/track/${providerOrderId}`,
      carrier: "MockPost",
    };
  }
}
