// Asking for the second factor again, at the actions that cannot be undone.
//
// A note on how the assurance level is established, because the shape of it
// looks unsafe and isn't:
//
// getAuthenticatorAssuranceLevel(jwt) reads the `aal` claim by *decoding*
// the token, not by verifying its signature. On its own that would be a hole
// — the token lives in a cookie the browser holds, so a claim read out of it
// is attacker-controlled. What closes it is that the same call also does
// getUser(jwt), which is a round trip to the auth server, and returns its
// error if that fails. A tampered payload breaks the signature, so getUser
// rejects it and no level is returned at all. The claim is therefore only
// ever read from a token the server has just confirmed is genuine.
//
// This module exists partly to hold that paragraph. Anyone reading the
// one-line call at a use site would reasonably assume otherwise.

import { cookies } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { ACCESS_COOKIE } from "@/lib/supabase/server";
import { isDemoMode } from "@/lib/supabase/demo";
import {
  asAssuranceLevel,
  requiresStepUp,
  type Assurance,
  type ProtectedAction,
} from "./mfa";

/** Thrown rather than redirected, so a caller decides how to surface it. */
export class StepUpRequired extends Error {
  constructor(readonly action: ProtectedAction) {
    super(`second factor required for ${action}`);
    this.name = "StepUpRequired";
  }
}

/**
 * What this session has proved.
 *
 * Returns nulls rather than throwing when there is no session: the callers
 * are already behind requireUser(), and a missing token here means "cannot
 * ask for a factor", not "grant access".
 */
export async function currentAssurance(): Promise<Assurance> {
  if (isDemoMode()) {
    // The demo has no auth server to ask. It reports a session that has
    // already proved a second factor, so the protected screens are walkable
    // — and it never reports having *no* factor, which would quietly make
    // the guards look like they pass when they were never exercised.
    return { currentLevel: "aal2", nextLevel: "aal2" };
  }

  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return { currentLevel: null, nextLevel: null };

  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel(token);
  // An error here means the token did not check out. Treat it as proving
  // nothing rather than as an outage to be waved through.
  if (error || !data) return { currentLevel: null, nextLevel: null };
  return {
    currentLevel: asAssuranceLevel(data.currentLevel),
    nextLevel: asAssuranceLevel(data.nextLevel),
  };
}

/**
 * Guard an irreversible action.
 *
 * Throws StepUpRequired when the account has a factor and this session has
 * not used it. Passes when there is no factor to ask for — see the comment
 * on requiresStepUp for why that is deliberate rather than a gap.
 */
export async function requireSecondFactor(action: ProtectedAction): Promise<void> {
  const assurance = await currentAssurance();
  if (requiresStepUp(assurance)) throw new StepUpRequired(action);
}

/** Where to send someone who has to prove themselves before continuing. */
export function stepUpPath(action: ProtectedAction, next: string): string {
  return `/settings/security/confirm?action=${encodeURIComponent(action)}&next=${encodeURIComponent(next)}`;
}
