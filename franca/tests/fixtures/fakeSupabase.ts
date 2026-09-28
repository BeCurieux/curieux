/**
 * A fake of Supabase's RPC endpoint for the eleven functions in
 * supabase/migrations/…_shopify_app_storage.sql, keeping the same rules the SQL
 * keeps (each of which was exercised against the live project when the
 * migration landed). It also records every request, so tests can assert on
 * what actually left the app — in particular, that no plain token ever does.
 */

type Row = Record<string, unknown>;

export function fakeSupabase(secretKey: string) {
  const installations = new Map<string, Row>();
  const catalogues = new Map<string, Row>();
  const products = new Map<string, Map<string, { updatedAt: string | null; scan: Row }>>();
  const deliveries = new Map<string, { shop: string | null; status: string; startedAt: string }>();
  const requests: Array<{ fn: string; headers: Record<string, string>; body: string }> = [];

  const SHOP = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;
  const seconds = (interval: string) => Number(/^(\d+) seconds$/.exec(interval)?.[1] ?? NaN);

  const fns: Record<string, (a: Row) => unknown> = {
    franca_get_installation: (a) => installations.get(a["p_shop"] as string) ?? null,
    franca_put_installation: (a) => {
      const row = a["p_row"] as Row;
      if (!SHOP.test(String(row["shop"]))) throw Object.assign(new Error("check_violation"), { status: 400 });
      installations.set(row["shop"] as string, row);
    },
    franca_get_catalogue: (a) => {
      const shop = a["p_shop"] as string;
      const meta = catalogues.get(shop);
      if (!meta) return null;
      const scans = [...(products.get(shop)?.entries() ?? [])].sort(([x], [y]) => x.localeCompare(y)).map(([, p]) => p.scan);
      return { ...meta, products: scans };
    },
    franca_replace_catalogue: (a) => {
      const shop = a["p_shop"] as string;
      catalogues.set(shop, {
        scannedAt: a["p_scanned_at"],
        jurisdictions: a["p_jurisdictions"],
        packVersions: a["p_pack_versions"],
        truncated: a["p_truncated"],
      });
      const next = new Map<string, { updatedAt: string | null; scan: Row }>();
      for (const e of a["p_products"] as Row[]) {
        next.set(e["gid"] as string, { updatedAt: (e["productUpdatedAt"] as string) ?? null, scan: e["scan"] as Row });
      }
      products.set(shop, next);
    },
    franca_put_product_scan: (a) => {
      const shop = a["p_shop"] as string;
      const held = products.get(shop);
      if (!catalogues.has(shop) || !held) return false;
      const gid = a["p_gid"] as string;
      const incoming = (a["p_product_updated_at"] as string | null) ?? null;
      const current = held.get(gid);
      if (current && current.updatedAt && incoming && Date.parse(incoming) < Date.parse(current.updatedAt)) return false;
      held.set(gid, { updatedAt: incoming, scan: a["p_scan"] as Row });
      return true;
    },
    franca_mark_product_stale: (a) => {
      const held = products.get(a["p_shop"] as string)?.get(a["p_gid"] as string);
      if (held) held.scan = { ...held.scan, badge: false, stale: true };
    },
    franca_remove_product_scan: (a) => {
      products.get(a["p_shop"] as string)?.delete(a["p_gid"] as string);
    },
    franca_claim_delivery: (a) => {
      const id = a["p_webhook_id"] as string;
      const now = a["p_now"] as string;
      const held = deliveries.get(id);
      const abandoned =
        held?.status === "processing" && Date.parse(held.startedAt) <= Date.parse(now) - seconds(a["p_abandoned_after"] as string) * 1000;
      if (!held || held.status === "failed" || abandoned) {
        deliveries.set(id, { shop: (a["p_shop"] as string) ?? null, status: "processing", startedAt: now });
        return "claimed";
      }
      return held.status === "done" ? "already-processed" : "in-flight";
    },
    franca_settle_delivery: (a) => {
      const held = deliveries.get(a["p_webhook_id"] as string);
      if (held) held.status = a["p_status"] as string;
    },
    franca_prune_deliveries: (a) => {
      let gone = 0;
      for (const [id, d] of deliveries) {
        if (Date.parse(d.startedAt) < Date.parse(a["p_before"] as string)) {
          deliveries.delete(id);
          gone += 1;
        }
      }
      return gone;
    },
    franca_redact_shop: (a) => {
      const shop = a["p_shop"] as string;
      for (const [id, d] of deliveries) if (d.shop === shop) deliveries.delete(id);
      installations.delete(shop);
      catalogues.delete(shop);
      products.delete(shop);
    },
  };

  async function transport(url: string, init: { method: string; headers: Record<string, string>; body: string }) {
    const fn = /\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url)?.[1] ?? "";
    requests.push({ fn, headers: init.headers, body: init.body });
    if (init.headers["apikey"] !== secretKey) return new Response('{"message":"Invalid API key"}', { status: 401 });
    const handler = fns[fn];
    if (!handler) return new Response('{"message":"not found"}', { status: 404 });
    try {
      const result = handler(JSON.parse(init.body) as Row);
      // PostgREST answers a void function with no body.
      return result === undefined ? new Response(null, { status: 204 }) : Response.json(result);
    } catch (error) {
      return new Response(JSON.stringify({ message: String(error) }), { status: (error as { status?: number }).status ?? 500 });
    }
  }

  return { transport, requests, installations, deliveries };
}
