import type { ProductType, Purchase } from "@/lib/domain/records";

// The payment provider boundary. Gumroad today (gumroad.ts); a Stripe
// Checkout implementation would slot in here without touching entitlements,
// the studio or the database (docs/PAYMENTS.md).

export interface VerifiedSale {
  externalPurchaseId: string;
  productType: ProductType;
  email: string;
  status: Purchase["status"];
  amountCents: number | null;
  currency: string | null;
  licenseKey: string | null;
  purchasedAt: string;
}

export interface BillingProvider {
  readonly name: "gumroad";
  /** A licence key the customer typed in, checked with the provider. */
  verifyLicense(licenseKey: string, productId?: string): Promise<VerifiedSale | null>;
  /** One sale, looked up by id. Null when it can't be checked. */
  lookupSale(saleId: string): Promise<VerifiedSale | null>;
  /** Sales to an email address (needs a seller token; [] without one). */
  salesForEmail(email: string): Promise<VerifiedSale[]>;
}
