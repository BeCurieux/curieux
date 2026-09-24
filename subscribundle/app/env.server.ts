/**
 * Server configuration, read once and checked at startup.
 *
 * A missing secret should stop the server with a message naming the variable,
 * not surface later as an OAuth loop or a failed database query.
 */

const REQUIRED = [
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_URL",
  "SCOPES",
  "DATABASE_URL",
] as const;

export interface ServerEnv {
  shopifyApiKey: string;
  shopifyApiSecret: string;
  appUrl: string;
  scopes: string[];
  databaseUrl: string;
  shopCustomDomain?: string;
}

export class MissingEnvError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Copy .env.example to .env and fill them in.",
    );
    this.name = "MissingEnvError";
  }
}

export function readServerEnv(
  source: Record<string, string | undefined>,
): ServerEnv {
  const missing = REQUIRED.filter((name) => !source[name]?.trim());
  if (missing.length > 0) throw new MissingEnvError([...missing]);

  const appUrl = source.SHOPIFY_APP_URL!.trim();
  try {
    new URL(appUrl);
  } catch {
    throw new Error(`SHOPIFY_APP_URL is not a valid URL: ${appUrl}`);
  }

  return {
    shopifyApiKey: source.SHOPIFY_API_KEY!.trim(),
    shopifyApiSecret: source.SHOPIFY_API_SECRET!.trim(),
    appUrl,
    scopes: source
      .SCOPES!.split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
    databaseUrl: source.DATABASE_URL!.trim(),
    shopCustomDomain: source.SHOP_CUSTOM_DOMAIN?.trim() || undefined,
  };
}
