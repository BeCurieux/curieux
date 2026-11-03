import { createHmac, randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server } from "node:http";

// A stand-in for the parts of the Stripe API the course uses, so the
// end-to-end tests can buy, bump, credit and refund without real keys or a
// network. The app talks to it through the real Stripe SDK (STRIPE_API_BASE).
//
//   /v1/products, /v1/prices, /v1/coupons, /v1/checkout/sessions (+ line
//   items), /v1/refunds         the API calls the app and stripe:setup make
//   /pay/:session                a stand-in hosted Checkout page with "Pay"
//   /__state                     what the app sent, for the tests to check
//
// Paying sends a signed checkout.session.completed webhook to the app, and
// a refund sends charge.refunded, as Stripe does.

export const FAKE_STRIPE_PORT = 12111;
export const FAKE_STRIPE_BASE = `http://127.0.0.1:${FAKE_STRIPE_PORT}`;
export const FAKE_WEBHOOK_SECRET = "whsec_e2e_test";

type Obj = Record<string, unknown>;

interface Session {
  id: string;
  params: Obj;
  payment_status: "unpaid" | "paid";
  status: "open" | "complete";
  bump: boolean;
  payment_intent: string | null;
  amount_total: number | null;
}

const state = {
  products: new Map<string, Obj>(),
  prices: new Map<
    string,
    Obj & { id: string; unit_amount: number; currency: string; lookup_key: string | null }
  >(),
  coupons: new Map<string, Obj & { amount_off: number }>(),
  sessions: new Map<string, Session>(),
  refunds: [] as Obj[],
};

const id = (prefix: string) => `${prefix}_${randomBytes(8).toString("hex")}`;

/** Stripe's form encoding: a[b][0][c]=d → { a: { b: [ { c: "d" } ] } }. */
export function parseForm(body: string): Obj {
  const root: Obj = {};
  for (const [rawKey, value] of new URLSearchParams(body)) {
    const parts = rawKey.replace(/\]/g, "").split("[");
    let node: Obj | unknown[] = root;
    parts.forEach((part, i) => {
      const last = i === parts.length - 1;
      const nextIsIndex = !last && (/^\d+$/.test(parts[i + 1]!) || parts[i + 1] === "");
      const container = node as Record<string, unknown> & unknown[];
      const key = part === "" ? container.length : part;
      if (last) container[key as never] = value as never;
      else {
        container[key as never] ??= (nextIsIndex ? [] : {}) as never;
        node = container[key as never] as Obj | unknown[];
      }
    });
  }
  return root;
}

function sessionObject(session: Session) {
  const params = session.params as {
    success_url: string;
    cancel_url: string;
    metadata?: Obj;
    client_reference_id?: string;
    customer_email?: string;
    line_items: { price: string }[];
    optional_items?: { price: string }[];
    discounts?: { coupon: string }[];
  };
  const price = state.prices.get(params.line_items[0]!.price)!;
  return {
    id: session.id,
    object: "checkout.session",
    url: `${FAKE_STRIPE_BASE}/pay/${session.id}`,
    mode: "payment",
    status: session.status,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    currency: price.currency,
    client_reference_id: params.client_reference_id ?? null,
    customer_email: params.customer_email ?? null,
    metadata: params.metadata ?? {},
    payment_intent: session.payment_intent,
    success_url: params.success_url,
    cancel_url: params.cancel_url,
  };
}

function lineItems(session: Session) {
  const params = session.params as {
    line_items: { price: string }[];
    optional_items?: { price: string }[];
  };
  const prices = [
    params.line_items[0]!.price,
    ...(session.bump && params.optional_items ? [params.optional_items[0]!.price] : []),
  ];
  return {
    object: "list",
    has_more: false,
    url: `/v1/checkout/sessions/${session.id}/line_items`,
    data: prices.map((priceId) => {
      const price = state.prices.get(priceId)!;
      return {
        id: id("li"),
        object: "item",
        quantity: 1,
        amount_total: price.unit_amount,
        currency: price.currency,
        price,
      };
    }),
  };
}

async function sendWebhook(appWebhookUrl: string, type: string, object: Obj) {
  const payload = JSON.stringify({
    id: id("evt"),
    object: "event",
    type,
    api_version: "2026-01-01",
    created: Math.floor(Date.now() / 1000),
    data: { object },
  });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", FAKE_WEBHOOK_SECRET).update(`${t}.${payload}`).digest("hex");
  const response = await fetch(appWebhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${v1}` },
    body: payload,
  });
  if (!response.ok)
    console.error("fake stripe: webhook", type, response.status, await response.text());
}

const read = (request: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
  });

export function startFakeStripe(appWebhookUrl: string): Promise<Server> {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url!, FAKE_STRIPE_BASE);
    const body = request.method === "POST" ? await read(request) : "";
    const json = (status: number, value: unknown) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(value));
    };
    const fail = (status: number, message: string, code?: string) =>
      json(status, { error: { type: "invalid_request_error", message, code } });
    const path = url.pathname;
    let m: RegExpMatchArray | null;

    if (request.method === "POST" && path === "/v1/products") {
      const params = parseForm(body);
      const product = {
        id: id("prod"),
        object: "product",
        name: params.name,
        metadata: params.metadata ?? {},
      };
      state.products.set(product.id, product);
      return json(200, product);
    }
    if (request.method === "POST" && path === "/v1/prices") {
      const params = parseForm(body) as Obj & { lookup_key?: string; transfer_lookup_key?: string };
      if (params.lookup_key && params.transfer_lookup_key === "true")
        for (const price of state.prices.values())
          if (price.lookup_key === params.lookup_key) price.lookup_key = null;
      const price = {
        id: id("price"),
        object: "price",
        active: true,
        product: String(params.product),
        currency: String(params.currency),
        unit_amount: Number(params.unit_amount),
        lookup_key: params.lookup_key ?? null,
      };
      state.prices.set(price.id, price);
      return json(200, price);
    }
    if (request.method === "GET" && path === "/v1/prices") {
      const keys = url.searchParams
        .getAll("lookup_keys[]")
        .concat(
          [...url.searchParams.entries()]
            .filter(([k]) => /^lookup_keys\[\d+\]$/.test(k))
            .map(([, v]) => v),
        );
      const data = [...state.prices.values()].filter(
        (p) => p.lookup_key && keys.includes(p.lookup_key),
      );
      return json(200, { object: "list", data, has_more: false, url: "/v1/prices" });
    }
    if (request.method === "POST" && path === "/v1/coupons") {
      const params = parseForm(body);
      const coupon = {
        id: id("coupon"),
        object: "coupon",
        ...params,
        amount_off: Number(params.amount_off),
      };
      state.coupons.set(coupon.id, coupon);
      return json(200, coupon);
    }
    if (request.method === "POST" && path === "/v1/checkout/sessions") {
      const params = parseForm(body) as Obj & { line_items?: { price: string }[] };
      const priceId = params.line_items?.[0]?.price;
      if (!priceId || !state.prices.has(priceId))
        return fail(400, `No such price: '${priceId}'`, "resource_missing");
      const session: Session = {
        id: id("cs_test"),
        params,
        payment_status: "unpaid",
        status: "open",
        bump: false,
        payment_intent: null,
        amount_total: null,
      };
      state.sessions.set(session.id, session);
      return json(200, sessionObject(session));
    }
    if (
      (m = path.match(/^\/v1\/checkout\/sessions\/([^/]+)(\/line_items)?$/)) &&
      request.method === "GET"
    ) {
      const session = state.sessions.get(m[1]!);
      if (!session) return fail(404, "No such checkout session", "resource_missing");
      return json(200, m[2] ? lineItems(session) : sessionObject(session));
    }
    if (request.method === "POST" && path === "/v1/refunds") {
      const params = parseForm(body) as { payment_intent?: string };
      if (state.refunds.some((r) => r.payment_intent === params.payment_intent))
        return fail(400, "Charge has already been refunded.", "charge_already_refunded");
      const refund = {
        id: id("re"),
        object: "refund",
        status: "succeeded",
        payment_intent: params.payment_intent,
      };
      state.refunds.push(refund);
      // Stripe follows a refund with charge.refunded.
      void sendWebhook(appWebhookUrl, "charge.refunded", {
        id: id("ch"),
        object: "charge",
        refunded: true,
        payment_intent: params.payment_intent,
      });
      return json(200, refund);
    }
    if ((m = path.match(/^\/pay\/([^/]+)$/))) {
      const session = state.sessions.get(m[1]!);
      if (!session) return fail(404, "No such checkout session");
      const params = session.params as {
        line_items: { price: string }[];
        optional_items?: { price: string }[];
        discounts?: { coupon: string }[];
        success_url: string;
      };
      if (request.method === "GET") {
        const main = state.prices.get(params.line_items[0]!.price)!;
        const bump = params.optional_items
          ? state.prices.get(params.optional_items[0]!.price)
          : undefined;
        const coupon = params.discounts
          ? state.coupons.get(params.discounts[0]!.coupon)
          : undefined;
        response.writeHead(200, { "content-type": "text/html" });
        return response.end(`<!doctype html><html lang="en"><title>Test checkout</title><main>
          <h1>Test checkout</h1>
          <p id="amount">${main.currency.toUpperCase()} ${(main.unit_amount / 100).toFixed(2)}</p>
          ${coupon ? `<p id="discount">Discount ${(coupon.amount_off / 100).toFixed(2)}</p>` : ""}
          <form method="post">
            ${bump ? `<label><input type="checkbox" name="bump"> Add the benchmark pack (${(bump.unit_amount / 100).toFixed(2)})</label>` : ""}
            <button type="submit">Pay</button>
          </form></main></html>`);
      }
      const form = parseForm(body);
      session.bump = Boolean(form.bump) && Boolean(params.optional_items);
      const main = state.prices.get(params.line_items[0]!.price)!.unit_amount;
      const bump = session.bump
        ? state.prices.get(params.optional_items![0]!.price)!.unit_amount
        : 0;
      const discount = params.discounts
        ? state.coupons.get(params.discounts[0]!.coupon)!.amount_off
        : 0;
      session.amount_total = main + bump - discount;
      session.payment_status = "paid";
      session.status = "complete";
      session.payment_intent = id("pi");
      await sendWebhook(appWebhookUrl, "checkout.session.completed", sessionObject(session));
      response.writeHead(303, {
        location: params.success_url.replace("{CHECKOUT_SESSION_ID}", session.id),
      });
      return response.end();
    }
    if (path === "/__state") {
      return json(200, {
        sessions: [...state.sessions.values()].map((s) => ({
          ...sessionObject(s),
          params: s.params,
          bump: s.bump,
        })),
        coupons: [...state.coupons.values()],
        refunds: state.refunds,
        prices: [...state.prices.values()],
      });
    }
    fail(404, `fake stripe: ${request.method} ${path} isn't implemented`);
  });
  return new Promise((resolve) =>
    server.listen(FAKE_STRIPE_PORT, "127.0.0.1", () => resolve(server)),
  );
}

/** What the app has sent so far (from the test process). */
export async function fakeStripeState() {
  return (await (await fetch(`${FAKE_STRIPE_BASE}/__state`)).json()) as {
    sessions: (Obj & {
      id: string;
      params: Obj;
      bump: boolean;
      amount_total: number | null;
      metadata: Obj;
      payment_intent: string | null;
    })[];
    coupons: (Obj & { amount_off: number; currency: string })[];
    refunds: (Obj & { payment_intent: string })[];
    prices: (Obj & {
      id: string;
      lookup_key: string | null;
      unit_amount: number;
      currency: string;
    })[];
  };
}
