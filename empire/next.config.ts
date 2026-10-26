import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The welcome emails are read from their source file at run time
  // (src/lib/email/welcome.ts), so the routes that send them carry it.
  outputFileTracingIncludes: {
    "/fit-check": ["./content/emails/welcome-sequence.md"],
    "/api/email/welcome": ["./content/emails/welcome-sequence.md"],
  },
  // Product photos and logos go to a server action; each is capped at 5 MB
  // in src/lib/uploads/validate.ts, so the default 1 MB is too small.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
