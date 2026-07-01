// Production wiring of the sender's dependencies: real store, real Anthropic
// generator + classifier, real web-push. One place so routes + cron share it.
import type { SenderDeps } from '@/lib/sender';
import { supabaseStore } from '@/lib/store.supabase';
import { anthropicGenerator, anthropicClassifier } from '@/lib/anthropic';
import { webPushSender } from '@/lib/push';

export function senderDeps(): SenderDeps {
  return {
    store: supabaseStore,
    generator: anthropicGenerator,
    classifier: anthropicClassifier,
    push: webPushSender,
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  };
}
