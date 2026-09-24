import { config } from "dotenv";
import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { readServerEnv } from "./env.server";

// Loads .env in development; in deployment the variables are already set.
config({ quiet: true });

const env = readServerEnv(process.env);

const shopify = shopifyApp({
  apiKey: env.shopifyApiKey,
  apiSecretKey: env.shopifyApiSecret,
  apiVersion: ApiVersion.July26,
  scopes: env.scopes,
  appUrl: env.appUrl,
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(env.shopCustomDomain
    ? { customShopDomains: [env.shopCustomDomain] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July26;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
