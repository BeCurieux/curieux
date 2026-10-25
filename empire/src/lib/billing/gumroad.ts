import { librarySlugFor } from "@/content/catalogue";
import type { ProductType, Purchase } from "@/lib/domain/records";
import type { BillingProvider, VerifiedSale } from "./provider";

// Gumroad, behind the BillingProvider interface.
//
// Nothing Gumroad *sends* us is trusted. A ping is only a hint that
// something happened: we look the sale up again through Gumroad's API and
// act on what that says. Two lookups are supported:
//
//   - licence verification (POST /v2/licenses/verify) — needs only the
//     product id; works when the product issues licence keys;
//   - sale lookup (GET /v2/sales/:id, GET /v2/sales?email=) — needs a
//     seller access token (GUMROAD_ACCESS_TOKEN), and also finds sales of
//     older products that never issued keys.
//
// docs/PAYMENTS.md has the setup and the reasoning.

const API = "https://api.gumroad.com/v2";

interface GumroadSale {
  id?: string;
  sale_id?: string;
  product_id: string;
  email: string;
  price?: number;
  currency?: string;
  created_at?: string;
  sale_timestamp?: string;
  refunded?: boolean;
  disputed?: boolean;
  chargebacked?: boolean;
  license_key?: string;
}

export interface GumroadConfig {
  launchPackProductId: string | null;
  accessToken: string | null;
  fetch?: typeof fetch;
}

export function productTypeFor(
  productId: string,
  launchPackProductId: string | null,
): ProductType | null {
  if (launchPackProductId && productId === launchPackProductId) return "launch_pack";
  const slug = librarySlugFor(productId);
  return slug ? `library:${slug}` : null;
}

function statusOf(sale: GumroadSale): Purchase["status"] {
  if (sale.refunded || sale.chargebacked) return "refunded";
  if (sale.disputed) return "disputed";
  return "paid";
}

export class GumroadProvider implements BillingProvider {
  readonly name = "gumroad" as const;
  private readonly fetch: typeof fetch;

  constructor(private readonly config: GumroadConfig) {
    this.fetch = config.fetch ?? fetch;
  }

  private toVerified(sale: GumroadSale, licenseKey: string | null): VerifiedSale | null {
    const productType = productTypeFor(sale.product_id, this.config.launchPackProductId);
    const id = sale.sale_id ?? sale.id;
    if (!productType || !id || !sale.email) return null;
    return {
      externalPurchaseId: id,
      productType,
      email: sale.email.trim().toLowerCase(),
      status: statusOf(sale),
      amountCents: typeof sale.price === "number" ? sale.price : null,
      currency: sale.currency?.toUpperCase() ?? null,
      licenseKey: licenseKey ?? sale.license_key ?? null,
      purchasedAt: new Date(sale.sale_timestamp ?? sale.created_at ?? Date.now()).toISOString(),
    };
  }

  async verifyLicense(licenseKey: string, productId?: string): Promise<VerifiedSale | null> {
    const key = licenseKey.trim();
    if (!/^[A-Za-z0-9-]{8,64}$/.test(key)) return null;
    const ids = [productId ?? this.config.launchPackProductId].filter(Boolean) as string[];
    for (const id of ids) {
      const response = await this.fetch(`${API}/licenses/verify`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          product_id: id,
          license_key: key,
          increment_uses_count: "false",
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`gumroad licence check failed: ${response.status}`);
      const body = (await response.json()) as { success?: boolean; purchase?: GumroadSale };
      if (body.success && body.purchase) {
        return this.toVerified(
          { ...body.purchase, product_id: body.purchase.product_id ?? id },
          key,
        );
      }
    }
    return null;
  }

  async lookupSale(saleId: string): Promise<VerifiedSale | null> {
    if (!this.config.accessToken) return null;
    const response = await this.fetch(`${API}/sales/${encodeURIComponent(saleId)}`, {
      headers: { authorization: `Bearer ${this.config.accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`gumroad sale lookup failed: ${response.status}`);
    const body = (await response.json()) as { success?: boolean; sale?: GumroadSale };
    return body.success && body.sale ? this.toVerified(body.sale, null) : null;
  }

  async salesForEmail(email: string): Promise<VerifiedSale[]> {
    if (!this.config.accessToken) return [];
    const out: VerifiedSale[] = [];
    let page: string | null =
      `${API}/sales?email=${encodeURIComponent(email.trim().toLowerCase())}`;
    for (let i = 0; page && i < 5; i += 1) {
      const response: Response = await this.fetch(page, {
        headers: { authorization: `Bearer ${this.config.accessToken}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`gumroad sales search failed: ${response.status}`);
      const body = (await response.json()) as {
        sales?: GumroadSale[];
        next_page_url?: string | null;
      };
      for (const sale of body.sales ?? []) {
        const verified = this.toVerified(sale, null);
        // Gumroad matches emails loosely; only exact matches count.
        if (verified && verified.email === email.trim().toLowerCase()) out.push(verified);
      }
      page = body.next_page_url
        ? new URL(body.next_page_url, "https://api.gumroad.com").toString()
        : null;
    }
    return out;
  }
}

/** The fields we read from a Gumroad ping (form-encoded). */
export function parsePing(form: URLSearchParams): {
  saleId: string | null;
  productId: string | null;
  licenseKey: string | null;
  ref: string | null;
} {
  const get = (key: string) => form.get(key)?.trim() || null;
  return {
    saleId: get("sale_id"),
    productId: get("product_id"),
    licenseKey: get("license_key"),
    ref: get("url_params[empire_ref]") ?? get("empire_ref"),
  };
}
