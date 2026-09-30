import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Moving a school in sends its spreadsheets (up to 2 MB each) to a server
  // action; the default limit is 1 MB.
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

// Source maps upload only when SENTRY_AUTH_TOKEN is present (Vercel), so
// local and CI builds need no Sentry account.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
});
