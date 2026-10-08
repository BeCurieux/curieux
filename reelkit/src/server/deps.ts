import { lookup } from "node:dns/promises";
import Anthropic from "@anthropic-ai/sdk";
import { stripeCheckout, stripeClient, stripeVerifier } from "../billing/stripe.js";
import { claudeDrafter } from "../script/claude.js";
import { config } from "./config.js";
import type { Deps } from "./handlers.js";
import { windowLimiter } from "./limit.js";
import { adminClient, supabaseCredits, viewer } from "./supabase.js";

let deps: Deps | undefined;

export function getDeps(): Deps {
  if (deps) return deps;
  const c = config();
  const stripe = c.stripe && c.supabase ? stripeClient(c.stripe.secretKey) : undefined;
  deps = {
    production: c.production,
    transport: (url, init) => fetch(url, init),
    lookup: async (host) => (await lookup(host, { all: true })).map((a) => a.address),
    imageSecret: c.imageSecret,
    ...(c.etsyKey ? { etsyKey: c.etsyKey } : {}),
    ...(c.anthropicKey ? { drafter: claudeDrafter(new Anthropic({ apiKey: c.anthropicKey })) } : {}),
    viewer: c.supabase ? () => viewer(c.supabase!) : async () => null,
    ...(c.supabase ? { credits: supabaseCredits(adminClient(c.supabase)) } : {}),
    ...(stripe && c.stripe
      ? { checkout: stripeCheckout(stripe), verifyWebhook: stripeVerifier(stripe, c.stripe.webhookSecret) }
      : {}),
    ...(c.appUrl ? { appUrl: c.appUrl } : {}),
    importLimit: windowLimiter(30, 10 * 60_000),
    writeLimit: windowLimiter(20, 60 * 60_000),
    log: (event, data) => console.warn(`[reelkit] ${event}`, JSON.stringify(data)),
  };
  return deps;
}

/** For the auth routes, which talk to Supabase directly. */
export function supabaseEnv() {
  return config().supabase;
}
