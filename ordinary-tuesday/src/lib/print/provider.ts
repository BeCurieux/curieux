// Provider-agnostic print adapter (brief §3, §19).
// Core book-generation code never touches Prodigi (or any provider) directly.
// The print layer is white-label: provider branding is never shown to customers.

export interface PrintRecipient {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postcode: string;
  countryCode: string; // ISO 3166-1 alpha-2
}

export interface PrintQuoteRequest {
  sku: string;
  pageCount: number;
  copies: number;
  destinationCountryCode: string;
}

export interface PrintQuote {
  amount: number;
  currency: string;
  shippingAmount: number;
  estimatedDays: number | null;
}

export interface BookValidationInput {
  sku: string;
  pageCount: number;
  interiorPdfBytes: number;
  coverPdfBytes: number;
}

export interface BookValidationResult {
  valid: boolean;
  errors: string[];
}

export interface CreateOrderRequest {
  /** Caller-supplied idempotency key — providers must not duplicate orders. */
  idempotencyKey: string;
  sku: string;
  pageCount: number;
  copies: number;
  recipient: PrintRecipient;
  /** Short-lived signed URLs to the final print assets (§20). */
  interiorPdfUrl: string;
  coverPdfUrl: string;
}

export type ProviderOrderStatus =
  | "received" | "in_production" | "shipped" | "delivered" | "cancelled" | "error";

export interface ProviderOrder {
  providerOrderId: string;
  status: ProviderOrderStatus;
  cost?: { amount: number; currency: string };
}

export interface TrackingInfo {
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
}

export interface SpineRequest {
  sku: string;
  pageCount: number;
  /** Spine width varies by where the book is actually manufactured. */
  destinationCountryCode: string;
}

export interface SpineSpec {
  widthMm: number;
  /** True when the provider returned this; false when it is a local estimate. */
  authoritative: boolean;
}

export interface PrintProvider {
  readonly name: string;

  /**
   * Spine width for a given extent and production location (brief §6).
   * This is NOT ours to compute from paper caliper — it depends on the
   * binding and the facility, so it is queried before the cover is rendered
   * and the design system adapts to whatever comes back.
   */
  getSpineWidth(req: SpineRequest): Promise<SpineSpec>;

  getQuote(req: PrintQuoteRequest): Promise<PrintQuote>;
  validateBook(input: BookValidationInput): Promise<BookValidationResult>;
  createOrder(req: CreateOrderRequest): Promise<ProviderOrder>;
  getOrderStatus(providerOrderId: string): Promise<ProviderOrder>;
  cancelOrder?(providerOrderId: string): Promise<boolean>;
  getTracking(providerOrderId: string): Promise<TrackingInfo>;
}

let cached: PrintProvider | null = null;

export function getPrintProvider(): PrintProvider {
  if (cached) return cached;
  const name = process.env.PRINT_PROVIDER ?? "mock";
  if (name === "prodigi") {
    const { ProdigiProvider } = require("./prodigi") as typeof import("./prodigi");
    cached = new ProdigiProvider();
  } else {
    const { MockPrintProvider } = require("./mock") as typeof import("./mock");
    cached = new MockPrintProvider();
  }
  return cached;
}

/** Test seam. */
export function setPrintProvider(provider: PrintProvider | null): void {
  cached = provider;
}
