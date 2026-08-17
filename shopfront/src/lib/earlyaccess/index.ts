/**
 * Taking an early-access request.
 *
 * Small on purpose. The interesting decisions are two, and both are about
 * what happens when something goes wrong.
 *
 * **A failed write is reported.** `recordEarlyAccess` throws, the route
 * answers 503, and the form tells the person to email instead and shows the
 * address. The alternative — catch, log, render "thanks" — is a form that
 * lies, and it is the most common lie on the internet. It is also the one this
 * product least gets to tell, given that the rest of the page is arranged
 * around not claiming anything it cannot do.
 *
 * **A duplicate is not an error.** Somebody who submits twice because they
 * were not sure the first one worked has not done anything wrong, and there is
 * no unique constraint on the table for exactly that reason: two rows from one
 * person is a thing a human reading their inbox handles in a second, and a
 * rejection they cannot interpret is not.
 */

import { createLocalEarlyAccessStore, createSupabaseEarlyAccessStore, type EarlyAccessStore } from "./store";
import { normaliseStore, EarlyAccessRequest, type EarlyAccessRecord } from "./types";
import { serviceRoleClient } from "@/lib/publish/supabase";
import { storeNameFromEnv } from "@/lib/publish/store";

export { EarlyAccessRequest, LIMITS, normaliseStore } from "./types";
export type { EarlyAccessRecord } from "./types";
export type { EarlyAccessStore } from "./store";

export interface RecordOptions {
  store?: EarlyAccessStore;
}

export async function recordEarlyAccess(
  request: EarlyAccessRequest,
  options: RecordOptions = {},
): Promise<EarlyAccessRecord> {
  const store = options.store ?? defaultStore();

  // Normalised here rather than in the schema, so that validation stays a
  // question about what the person typed and cleanup stays a separate step
  // with its own test. A zod `.transform` would fuse the two.
  return store.record({
    ...request,
    store: normaliseStore(request.store),
    brief: request.brief?.trim() ? request.brief.trim() : undefined,
  });
}

export function defaultStore(): EarlyAccessStore {
  return storeNameFromEnv() === "supabase"
    ? createSupabaseEarlyAccessStore(serviceRoleClient())
    : createLocalEarlyAccessStore();
}
