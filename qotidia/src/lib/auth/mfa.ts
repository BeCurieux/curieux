// Second factors, and what they are actually for.
//
// A second factor that only guards the front door is close to theatre. The
// session cookie is the thing that gets stolen, and a stolen session can
// already do the one irreversible thing this product supports: delete a
// decade of a child's photographs. So the factor is asked for again at the
// actions that cannot be undone, not only at sign-in.
//
// Two kinds are offered and the order is deliberate:
//
//   A passkey is the recommendation. It is bound to the site's domain, which
//   means a convincing copy of our sign-in page cannot use it — the browser
//   simply will not offer it. Nothing a parent can be talked into typing.
//
//   An authenticator app is the fallback, because passkeys are still tied to
//   a device or a platform account, and a grandparent on an old Android
//   phone should not be locked out of their grandchild's archive over it.
//
// SMS is deliberately absent. A code sent to a phone number is the factor
// that gets taken from people, and offering it beside a passkey implies they
// are equivalent.

/** Our words. Supabase's are "webauthn" and "totp". */
export type SecondFactorKind = "passkey" | "authenticator";

// `as const` so each value keeps its own literal type. Without it both
// collapse to the union and enroll()'s overloads stop resolving — the
// response type loses the `totp` field the enrolment screen needs.
export const SUPABASE_FACTOR_TYPE = {
  passkey: "webauthn",
  authenticator: "totp",
} as const satisfies Record<SecondFactorKind, "webauthn" | "totp">;

export function kindFromFactorType(type: string): SecondFactorKind | null {
  if (type === "webauthn") return "passkey";
  if (type === "totp") return "authenticator";
  return null; // 'phone' — not offered, and not described as if it were
}

export const FACTOR_LABEL: Record<SecondFactorKind, string> = {
  passkey: "A passkey",
  authenticator: "An authenticator app",
};

export const FACTOR_BLURB: Record<SecondFactorKind, string> = {
  passkey:
    "Your face, fingerprint or device PIN. Nothing to type and nothing to lose, and it only works on this site — a fake sign-in page can't use it.",
  authenticator:
    "A six-digit code from an app like 1Password or Google Authenticator. Works on any device, including an old one.",
};

// ------------------------------------------------------- assurance levels

export type AssuranceLevel = "aal1" | "aal2" | null;

/**
 * Narrow whatever the auth client hands back.
 *
 * Its type is a loose string, so an unrecognised value is possible — a new
 * level, a typo, a future API. Anything we do not recognise becomes null,
 * which reads as "has proved nothing". Erring the other way would let an
 * unknown string satisfy a check on an irreversible action.
 */
export function asAssuranceLevel(value: string | null | undefined): AssuranceLevel {
  return value === "aal1" || value === "aal2" ? value : null;
}

export interface Assurance {
  /** What this session has proved so far. */
  currentLevel: AssuranceLevel;
  /** What it could prove — 'aal2' once any factor is enrolled and verified. */
  nextLevel: AssuranceLevel;
}

/**
 * Whether this session has to prove itself again before doing something
 * irreversible.
 *
 * Note what it returns for someone with no factor at all: false. Not because
 * that session is trustworthy, but because there is nothing to ask them for,
 * and a wall with no door behind it is worse than no wall — it teaches
 * people to click through prompts. The answer for that case is to offer
 * enrolment, which is what the settings page does.
 */
export function requiresStepUp(a: Assurance): boolean {
  return a.nextLevel === "aal2" && a.currentLevel !== "aal2";
}

/** Whether a second factor exists at all — i.e. whether step-up can be asked for. */
export function hasSecondFactor(a: Assurance): boolean {
  return a.nextLevel === "aal2";
}

/**
 * The actions that ask again.
 *
 * Short on purpose. Each of these either destroys something that cannot be
 * recovered or makes a copy that leaves our systems, and those are the two
 * things a stolen session should not be able to do quietly.
 */
export const PROTECTED_ACTIONS = {
  delete_everything: "deleting everything",
  export_archive: "downloading a copy of the whole archive",
  change_access: "changing who can see this archive",
  grant_support_access: "letting our support team in",
} as const;

export type ProtectedAction = keyof typeof PROTECTED_ACTIONS;

/** What the confirmation screen says you are about to do. */
export function stepUpReason(action: ProtectedAction): string {
  return PROTECTED_ACTIONS[action];
}

// ----------------------------------------------------------- relying party

/**
 * The WebAuthn relying party ID: the domain a passkey is bound to.
 *
 * This is the whole security property of a passkey, so it is derived from
 * the request's own origin rather than configured — a configured value that
 * drifts from the deployment silently produces credentials that no longer
 * work, and the failure appears months later at sign-in.
 *
 * The port is stripped because rpId is a domain and never carries one, which
 * is the thing that breaks localhost development if you pass the origin
 * straight through.
 */
export function rpIdFrom(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin.replace(/^https?:\/\//, "").split(":")[0].split("/")[0];
  }
}

// -------------------------------------------------------------- factor list

export interface EnrolledFactor {
  id: string;
  kind: SecondFactorKind;
  friendlyName: string | null;
  addedAt: string | null;
}

/**
 * The factors worth showing, newest last.
 *
 * Unverified factors are dropped: an enrolment that was started and
 * abandoned is a row in a table, not a thing protecting an account, and
 * listing it would tell a parent they are protected when they are not.
 */
export function enrolledFactors(
  factors: { id: string; factor_type: string; status: string; friendly_name?: string | null; created_at?: string }[]
): EnrolledFactor[] {
  return factors
    .filter((f) => f.status === "verified")
    .map((f) => ({
      id: f.id,
      kind: kindFromFactorType(f.factor_type),
      friendlyName: f.friendly_name ?? null,
      addedAt: f.created_at ?? null,
    }))
    .filter((f): f is EnrolledFactor => f.kind !== null)
    .sort((a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? ""));
}

/**
 * Whether removing this factor would leave the account with none.
 *
 * Not a refusal — it is their account and they may want it off. It is a
 * different sentence on the button, because "Remove" and "Remove the only
 * thing protecting a decade of photographs" deserve different warnings.
 */
export function isLastFactor(factors: EnrolledFactor[], factorId: string): boolean {
  return factors.length === 1 && factors[0].id === factorId;
}

/** A name for a factor the parent didn't name. Never "Factor 2". */
export function defaultFactorName(kind: SecondFactorKind, existing: EnrolledFactor[]): string {
  const sameKind = existing.filter((f) => f.kind === kind).length;
  const base = kind === "passkey" ? "Passkey" : "Authenticator app";
  return sameKind === 0 ? base : `${base} ${sameKind + 1}`;
}
