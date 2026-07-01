// Web push delivery boundary (CLAUDE.md §Web push specifics). Wraps the
// `web-push` lib. On 404/410 the subscription is dead — the caller prunes it.
// Injected so the sender stays testable without a real push service.

import webpush from 'web-push';
import type { Subscriber } from '@/lib/types';

export interface PushPayload {
  title: string;
  body: string;
  icon?: string | null;
  // Deep link to the PDP with ?haunt=<event_id> so clicks attribute back.
  url: string;
}

export interface PushResult {
  ok: boolean;
  // Set when the endpoint is gone (404/410) so the caller sets revoked_at.
  gone?: boolean;
}

export interface PushSender {
  send(sub: Pick<Subscriber, 'endpoint' | 'p256dh' | 'auth'>, payload: PushPayload): Promise<PushResult>;
}

let _configured = false;
function configure(): void {
  if (_configured) return;
  const { VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE || !VAPID_SUBJECT) {
    throw new Error('VAPID_PUBLIC / VAPID_PRIVATE / VAPID_SUBJECT must be set');
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  _configured = true;
}

export const webPushSender: PushSender = {
  async send(sub, payload) {
    configure();
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
      );
      return { ok: true };
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return { ok: false, gone: true };
      return { ok: false };
    }
  },
};
