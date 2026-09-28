import { scrubEvent } from "./scrub";

// Shared by the browser, Node and edge Sentry setups. Sentry is off unless a
// DSN is configured.
export function sentryOptions(dsn: string | undefined) {
  return {
    dsn,
    enabled: Boolean(dsn),
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  };
}
