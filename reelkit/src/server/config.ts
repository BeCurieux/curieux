/**
 * Every environment variable the app reads, in one place.
 *
 * Nothing is required to run locally: without ANTHROPIC_API_KEY the ads come
 * from templates, and without ETSY_API_KEY an Etsy link usually falls back to
 * manual entry. IMAGE_PROXY_SECRET is the one production needs, because every
 * serverless instance must agree on it or photos signed by one instance are
 * refused by the next.
 */

import { randomBytes } from "node:crypto";

let devSecret: string | undefined;

export type Config = {
  anthropicKey?: string;
  etsyKey?: string;
  imageSecret: string;
};

export function config(env: NodeJS.ProcessEnv = process.env): Config {
  let imageSecret = env.IMAGE_PROXY_SECRET?.trim();
  if (!imageSecret) {
    if (env.NODE_ENV === "production" && env.VERCEL) {
      throw new Error("IMAGE_PROXY_SECRET must be set in production (any long random string).");
    }
    imageSecret = devSecret ??= randomBytes(32).toString("hex");
  }
  return {
    ...(env.ANTHROPIC_API_KEY?.trim() ? { anthropicKey: env.ANTHROPIC_API_KEY.trim() } : {}),
    ...(env.ETSY_API_KEY?.trim() ? { etsyKey: env.ETSY_API_KEY.trim() } : {}),
    imageSecret,
  };
}
