import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";

// A stand-in for Resend's send-email API, so the tests can read exactly what
// the app emailed. The app reaches it through RESEND_API_BASE.

export const FAKE_RESEND_PORT = 12112;
export const FAKE_RESEND_BASE = `http://127.0.0.1:${FAKE_RESEND_PORT}`;

export interface SentEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  idempotencyKey: string | null;
}

const sent: SentEmail[] = [];

export function startFakeResend(): Promise<Server> {
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      const json = (status: number, value: unknown) => {
        response.writeHead(status, { "content-type": "application/json" });
        response.end(JSON.stringify(value));
      };
      if (request.method === "POST" && request.url === "/emails") {
        if (!request.headers.authorization?.startsWith("Bearer re_"))
          return json(401, { message: "bad key" });
        const email = {
          id: randomBytes(8).toString("hex"),
          ...JSON.parse(body),
          idempotencyKey: request.headers["idempotency-key"] ?? null,
        };
        sent.push(email);
        return json(200, { id: email.id });
      }
      if (request.method === "GET" && request.url?.startsWith("/__emails")) {
        const to = new URL(request.url, FAKE_RESEND_BASE).searchParams.get("to");
        return json(200, to ? sent.filter((e) => e.to.includes(to)) : sent);
      }
      json(404, { message: "not implemented" });
    });
  });
  return new Promise((resolve) =>
    server.listen(FAKE_RESEND_PORT, "127.0.0.1", () => resolve(server)),
  );
}

/** Everything the app has emailed this address, oldest first. */
export async function emailsTo(address: string): Promise<SentEmail[]> {
  return (await (
    await fetch(`${FAKE_RESEND_BASE}/__emails?to=${encodeURIComponent(address)}`)
  ).json()) as SentEmail[];
}

/** The first link in an email that matches. */
export function linkIn(email: SentEmail, pattern: RegExp): string {
  for (const m of email.html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1]!.replaceAll("&amp;", "&");
    if (pattern.test(href)) return href;
  }
  throw new Error(`no link matching ${pattern} in "${email.subject}"`);
}
