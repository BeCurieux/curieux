"use client";

/**
 * The page inside the Shopify admin: choose a plan if there is none, choose
 * markets, scan, and see every product's score, weakest first.
 *
 * Every call carries a fresh ID token from App Bridge (they live a minute, so
 * none is cached), and a 401 carrying Shopify's retry header is retried once
 * with a new one — the server sends that header exactly when a fresh token is
 * the fix.
 *
 * Voice is the card's: confident, warm, never legal-scary. Bands use the card's
 * own labels, and no colour here means pass or fail (CLAUDE.md, the card rules)
 * — Polaris badges are left in their neutral tone for the same reason.
 */

import { useCallback, useEffect, useState } from "react";
import { BAND_LABEL, MARKET_LABEL } from "@/card/tokens";
import type { CatalogueView, ProductView } from "@/server/view";

type SessionView = {
  shop: string;
  access: "granted" | "choose-plan" | "retry";
  plan: { handle: string; name: string; maxProducts: number | null; maxMarkets: number | null } | null;
  planUrl: string;
  markets: string[] | null;
  availableMarkets: string[];
  catalogue: CatalogueView | null;
};

async function call<T>(path: string, init: RequestInit = {}, retried = false): Promise<{ status: number; body: T }> {
  const token = await shopify.idToken();
  const response = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (response.status === 401 && !retried && response.headers.get("X-Shopify-Retry-Invalid-Session-Request")) {
    return call<T>(path, init, true);
  }
  return { status: response.status, body: (await response.json().catch(() => null)) as T };
}

export function Dashboard() {
  const [session, setSession] = useState<SessionView | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState<"markets" | "scan" | null>(null);

  const load = useCallback(async () => {
    setFailed(null);
    const { status, body } = await call<SessionView>("/api/shopify/session", { method: "POST" });
    if (status !== 200 || !body) {
      setFailed("Franca could not reach your store just now. Try again in a moment.");
      return;
    }
    setSession(body);
    setChosen(body.markets ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMarkets() {
    setBusy("markets");
    const { status, body } = await call<{ markets?: string[]; detail?: string }>("/api/shopify/markets", {
      method: "POST",
      body: JSON.stringify({ markets: chosen }),
    });
    setBusy(null);
    if (status === 200 && body?.markets) {
      setSession((s) => (s ? { ...s, markets: body.markets ?? null } : s));
      shopify.toast.show("Markets saved");
    } else {
      shopify.toast.show(body?.detail ?? "Those markets could not be saved.", { isError: true });
    }
  }

  async function scan() {
    setBusy("scan");
    const { status, body } = await call<CatalogueView & { error?: string }>("/api/shopify/scan", { method: "POST" });
    setBusy(null);
    if (status === 200 && body) {
      setSession((s) => (s ? { ...s, catalogue: body } : s));
      shopify.toast.show(`Read ${body.summary.products} product${body.summary.products === 1 ? "" : "s"}`);
    } else if (body?.error === "choose-markets") {
      shopify.toast.show("Choose your markets again — your plan has changed.", { isError: true });
    } else {
      shopify.toast.show("The scan did not finish. Nothing was changed; try again.", { isError: true });
    }
  }

  if (failed) {
    return (
      <s-page heading="Franca">
        <s-banner tone="critical" heading="Not connected">
          <s-paragraph>{failed}</s-paragraph>
          <s-button onClick={() => void load()}>Try again</s-button>
        </s-banner>
      </s-page>
    );
  }

  if (!session) {
    return (
      <s-page heading="Franca">
        <s-section>
          <s-spinner accessibilityLabel="Loading" />
        </s-section>
      </s-page>
    );
  }

  if (session.access === "choose-plan") {
    return (
      <s-page heading="Franca">
        <s-section heading="Choose a plan to begin">
          <s-paragraph>
            Franca reads the words on every product page and shows you which ones draw attention in the markets you
            sell into — with the rule behind each note, and a mark for the pages that read clean.
          </s-paragraph>
          <s-button variant="primary" onClick={() => window.open(session.planUrl, "_top")}>
            See plans
          </s-button>
        </s-section>
      </s-page>
    );
  }

  if (session.access === "retry" || !session.plan) {
    return (
      <s-page heading="Franca">
        <s-banner heading="We could not confirm your plan">
          <s-paragraph>Nothing is wrong with your subscription; Shopify did not answer in time.</s-paragraph>
          <s-button onClick={() => void load()}>Try again</s-button>
        </s-banner>
      </s-page>
    );
  }

  const plan = session.plan;
  const saved = session.markets ?? [];
  const unsaved = chosen.join() !== saved.join();
  const catalogue = session.catalogue;

  return (
    <s-page heading="Franca">
      <s-section heading="Where you sell">
        <s-choice-list
          label={`Your ${plan.name} plan covers ${plan.maxMarkets === null ? "every market" : `${plan.maxMarkets} market${plan.maxMarkets === 1 ? "" : "s"}`}.`}
          name="markets"
          multiple
          onChange={(event) => setChosen([...((event.currentTarget as unknown as { values?: string[] }).values ?? [])])}
        >
          {session.availableMarkets.map((market) => (
            <s-choice key={market} value={market} selected={chosen.includes(market)}>
              {MARKET_LABEL[market] ?? market}
            </s-choice>
          ))}
        </s-choice-list>
        <s-button disabled={!unsaved || busy !== null} loading={busy === "markets"} onClick={() => void saveMarkets()}>
          Save markets
        </s-button>
      </s-section>

      <s-section heading="Your products">
        <s-paragraph>
          {plan.maxProducts === null
            ? "Franca reads every product in your store."
            : `Your plan reads up to ${plan.maxProducts} products.`}
        </s-paragraph>
        <s-button
          variant="primary"
          disabled={saved.length === 0 || unsaved || busy !== null}
          loading={busy === "scan"}
          onClick={() => void scan()}
        >
          {catalogue ? "Scan again" : "Scan my store"}
        </s-button>
      </s-section>

      {catalogue ? <Results catalogue={catalogue} /> : null}
    </s-page>
  );
}

function Results({ catalogue }: { catalogue: CatalogueView }) {
  const { summary } = catalogue;
  const weakest = summary.weakest;
  return (
    <>
      <s-section heading="How it reads">
        <s-paragraph>
          {weakest
            ? `Your lowest-scoring page is ${weakest.title || weakest.handle}, at ${weakest.score}. That is the number a store is judged by, so it leads.`
            : "None of these products had any copy to read yet."}
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-badge>{`${summary.byBand.clear} ${BAND_LABEL.clear.toLowerCase()}`}</s-badge>
          <s-badge>{`${summary.byBand.review} ${BAND_LABEL.review.toLowerCase()}`}</s-badge>
          <s-badge>{`${summary.byBand.rework} ${BAND_LABEL.rework.toLowerCase()}`}</s-badge>
          {summary.unread > 0 ? <s-badge>{`${summary.unread} with no copy`}</s-badge> : null}
          <s-badge>{`${summary.badges} carrying the mark`}</s-badge>
        </s-stack>
        {catalogue.truncated ? (
          <s-paragraph>These are the first products your plan covers; your store has more.</s-paragraph>
        ) : null}
      </s-section>

      <s-section padding="none">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Product</s-table-header>
            <s-table-header format="numeric">Score</s-table-header>
            <s-table-header>Reading</s-table-header>
            <s-table-header>Mark</s-table-header>
            <s-table-header listSlot="secondary">What to look at first</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {catalogue.products.map((product) => (
              <ProductRow key={product.gid} product={product} />
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section>
        <s-paragraph>{catalogue.disclaimer}</s-paragraph>
      </s-section>
    </>
  );
}

function ProductRow({ product }: { product: ProductView }) {
  const reading = product.band ? BAND_LABEL[product.band] : "No copy to read";
  const mark = product.stale ? "Paused — changed since the last read" : product.badge ? "Yes" : "—";
  const note = product.top ? `“${product.top.phrase}” — ${product.top.headline}` : product.findings === 0 ? "Nothing trips a rule." : "";
  return (
    <s-table-row>
      <s-table-cell>
        {product.title}
        {product.status !== "ACTIVE" ? ` (${product.status.toLowerCase()})` : ""}
      </s-table-cell>
      <s-table-cell>{product.score ?? "—"}</s-table-cell>
      <s-table-cell>{reading}</s-table-cell>
      <s-table-cell>{mark}</s-table-cell>
      <s-table-cell>{note}</s-table-cell>
    </s-table-row>
  );
}
