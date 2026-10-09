"use client";

/**
 * The page inside the Shopify admin, M1: the catalogue as synced, with the
 * products detected as supplements and why. Markets, scans and findings
 * arrive in M2.
 *
 * Every call carries a fresh ID token from App Bridge, and a 401 carrying
 * Shopify's retry header is retried once with a new one.
 */

import { useCallback, useEffect, useState } from "react";
import type { CatalogueSummary } from "@/catalogue/sync";

type SessionView = { shop: string; installedAt: string; catalogue: CatalogueSummary; disclaimer: string };

async function call<T>(path: string, retried = false): Promise<{ status: number; body: T | null }> {
  const token = await shopify.idToken();
  const response = await fetch(path, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  if (response.status === 401 && !retried && response.headers.get("X-Shopify-Retry-Invalid-Session-Request")) {
    return call<T>(path, true);
  }
  return { status: response.status, body: (await response.json().catch(() => null)) as T | null };
}

export function Dashboard() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sync = useCallback(async () => {
    setSyncing(true);
    const { status, body } = await call<{ catalogue: CatalogueSummary; truncated: boolean }>("/api/shopify/sync");
    setSyncing(false);
    if (status !== 200 || !body) {
      shopify.toast.show("The catalogue could not be read just now.", { isError: true });
      return;
    }
    setSession((s) => (s ? { ...s, catalogue: body.catalogue } : s));
    shopify.toast.show(`${body.catalogue.supplements} supplements found in ${body.catalogue.total} products`);
  }, []);

  useEffect(() => {
    void (async () => {
      const { status, body } = await call<SessionView>("/api/shopify/session");
      if (status !== 200 || !body) return setFailed("MarketFit could not reach your store just now. Try again in a moment.");
      setSession(body);
      // First open after install: read the catalogue straight away (§7.1).
      if (body.catalogue.total === 0) void sync();
    })();
  }, [sync]);

  if (failed) return <s-page heading="MarketFit"><s-banner tone="critical">{failed}</s-banner></s-page>;
  if (!session) return <s-page heading="MarketFit"><s-spinner /></s-page>;

  const supplements = session.catalogue.products.filter((p) => p.category === "supplements");
  return (
    <s-page heading="MarketFit">
      <s-section heading="Your catalogue">
        <s-paragraph>
          {session.catalogue.total} products synced from {session.shop}; {supplements.length} look like supplements.
        </s-paragraph>
        <s-button onClick={() => void sync()} loading={syncing || undefined}>
          Sync catalogue
        </s-button>
      </s-section>
      <s-section heading="Supplements">
        {supplements.length === 0 ? (
          <s-paragraph>No supplements detected yet.</s-paragraph>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Product</s-table-header>
              <s-table-header>Why it was detected</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {supplements.map((p) => (
                <s-table-row key={p.shopifyProductId}>
                  <s-table-cell>{p.title}</s-table-cell>
                  <s-table-cell>{p.categoryReason}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
      <s-section>
        <s-text tone="subdued">{session.disclaimer}</s-text>
      </s-section>
    </s-page>
  );
}
