// Prodigi implementation of PrintProvider.
// All Prodigi-specific knowledge lives here (brief §3: no Prodigi logic in
// core book-generation code). Uses the v4 REST API; sandbox URL via env.

import type {
  BookValidationInput, BookValidationResult, CreateOrderRequest, PrintProvider,
  PrintQuote, PrintQuoteRequest, ProviderOrder, ProviderOrderStatus, TrackingInfo,
} from "./provider";

export class ProdigiProvider implements PrintProvider {
  readonly name = "prodigi";
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.PRODIGI_API_URL ?? "https://api.sandbox.prodigi.com/v4.0";
    this.apiKey = process.env.PRODIGI_API_KEY ?? "";
    if (!this.apiKey) throw new Error("PRODIGI_API_KEY is not set");
  }

  private async request<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "X-API-Key": this.apiKey,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`prodigi ${method} ${path} failed: ${res.status} ${text.slice(0, 300)}`);
    }
    return (await res.json()) as T;
  }

  async getQuote(req: PrintQuoteRequest): Promise<PrintQuote> {
    const out = await this.request<any>("POST", "/quotes", {
      shippingMethod: "Standard",
      destinationCountryCode: req.destinationCountryCode,
      items: [
        {
          sku: req.sku,
          copies: req.copies,
          attributes: {},
          assets: [{ printArea: "default" }],
          pageCount: req.pageCount,
        },
      ],
    });
    const quote = out.quotes?.[0];
    const items = Number(quote?.costSummary?.items?.amount ?? 0);
    const shipping = Number(quote?.costSummary?.shipping?.amount ?? 0);
    return {
      amount: items + shipping,
      currency: quote?.costSummary?.items?.currency ?? "USD",
      shippingAmount: shipping,
      estimatedDays: null,
    };
  }

  async validateBook(input: BookValidationInput): Promise<BookValidationResult> {
    // Prodigi has no pre-submission validation endpoint; enforce local
    // provider constraints here (page counts for photobook SKUs).
    const errors: string[] = [];
    if (input.pageCount % 2 !== 0) errors.push("page count must be even");
    if (input.pageCount < 24) errors.push("prodigi hardcover books require at least 24 pages");
    if (input.pageCount > 240) errors.push("prodigi hardcover books allow at most 240 pages");
    if (input.interiorPdfBytes <= 0) errors.push("interior PDF is empty");
    if (input.coverPdfBytes <= 0) errors.push("cover PDF is empty");
    return { valid: errors.length === 0, errors };
  }

  async createOrder(req: CreateOrderRequest): Promise<ProviderOrder> {
    const out = await this.request<any>(
      "POST",
      "/orders",
      {
        merchantReference: req.idempotencyKey,
        shippingMethod: "Standard",
        idempotencyKey: req.idempotencyKey,
        recipient: {
          name: req.recipient.name,
          address: {
            line1: req.recipient.line1,
            line2: req.recipient.line2 ?? null,
            townOrCity: req.recipient.city,
            stateOrCounty: req.recipient.region ?? null,
            postalOrZipCode: req.recipient.postcode,
            countryCode: req.recipient.countryCode,
          },
        },
        items: [
          {
            merchantReference: `${req.idempotencyKey}-item`,
            sku: req.sku,
            copies: req.copies,
            sizing: "fillPrintArea",
            attributes: {},
            assets: [
              { printArea: "cover", url: req.coverPdfUrl },
              { printArea: "default", url: req.interiorPdfUrl },
            ],
          },
        ],
      },
      req.idempotencyKey
    );
    return {
      providerOrderId: out.order?.id ?? "",
      status: mapStage(out.order?.status?.stage),
    };
  }

  async getOrderStatus(providerOrderId: string): Promise<ProviderOrder> {
    const out = await this.request<any>("GET", `/orders/${providerOrderId}`);
    return {
      providerOrderId,
      status: mapStage(out.order?.status?.stage),
    };
  }

  async cancelOrder(providerOrderId: string): Promise<boolean> {
    try {
      await this.request("POST", `/orders/${providerOrderId}/actions/cancel`, {});
      return true;
    } catch {
      return false;
    }
  }

  async getTracking(providerOrderId: string): Promise<TrackingInfo> {
    const out = await this.request<any>("GET", `/orders/${providerOrderId}`);
    const shipment = out.order?.shipments?.[0];
    return {
      trackingNumber: shipment?.tracking?.number ?? null,
      trackingUrl: shipment?.tracking?.url ?? null,
      carrier: shipment?.carrier?.name ?? null,
    };
  }
}

function mapStage(stage: string | undefined): ProviderOrderStatus {
  switch (stage) {
    case "InProgress": return "in_production";
    case "Complete": return "shipped";
    case "Cancelled": return "cancelled";
    default: return "received";
  }
}
