import { lookup } from "node:dns/promises";
import Anthropic from "@anthropic-ai/sdk";
import { claudeDrafter } from "../script/claude.js";
import { config } from "./config.js";
import type { Deps } from "./handlers.js";
import { windowLimiter } from "./limit.js";

let deps: Deps | undefined;

export function getDeps(): Deps {
  if (deps) return deps;
  const c = config();
  deps = {
    transport: (url, init) => fetch(url, init),
    lookup: async (host) => (await lookup(host, { all: true })).map((a) => a.address),
    imageSecret: c.imageSecret,
    ...(c.etsyKey ? { etsyKey: c.etsyKey } : {}),
    ...(c.anthropicKey ? { drafter: claudeDrafter(new Anthropic({ apiKey: c.anthropicKey })) } : {}),
    importLimit: windowLimiter(30, 10 * 60_000),
    writeLimit: windowLimiter(12, 60 * 60_000),
    log: (event, data) => console.warn(`[reelkit] ${event}`, JSON.stringify(data)),
  };
  return deps;
}
