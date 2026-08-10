// What happens to the archive when the person who made it cannot keep it.
//
// This product asks a parent to put eighteen years of their child's life in
// one place, behind one login. Some of those parents will die before the
// child is grown. Today that means the archive is simply unreachable: nobody
// else can approve a book, nobody can pay for one, nobody can take an export
// — and eventually the card fails, the renewal lapses, and the most complete
// record of a childhood sits behind a login nobody can pass.
//
// A *keeper* is somebody the owner names in advance who takes the archive
// over. The whole difficulty is the handover, because the same mechanism
// that rescues an archive from a death is the mechanism that steals one from
// a living person. Everything below is shaped by that.
//
// ## Two ways it can start, because they fail differently
//
//   **A claim.** The keeper says the owner has died. Fast, and the one that
//   can be abused — so it is the one wrapped in notice.
//
//   **Silence.** Nobody has signed in for a very long time and nobody has
//   said anything. Slow, requires no judgement from us and no death
//   certificate, and it is the only path that works when there is nobody
//   left who knows to make a claim.
//
// ## The rules that make it safe
//
//   **Any sign of life ends it.** Not a button — signing in is enough. The
//   person being declared dead should not have to find a form to disagree.
//
//   **Nothing happens quietly.** Naming a keeper emails the owner. Opening a
//   claim emails the owner, repeatedly, for a month, and puts a notice on
//   every page. An attacker with a session has to also intercept a month of
//   mail.
//
//   **A new keeper cannot claim immediately.** Someone who gets into an
//   account and names themselves has to then wait, in the open, while the
//   real owner is emailed about it.
//
//   **Nothing is destroyed, ever.** A handover changes who holds the keys.
//   The previous owner keeps their membership, their name stays on
//   everything they wrote, and a handover made in error can be undone.
//
//   **No keeper, no handover.** If nobody was named, silence does nothing at
//   all. We do not find someone to give a family's archive to.

/** How long after being named a keeper may first claim. */
export const SETTLING_DAYS = 30;

/**
 * How long a claim waits before it completes.
 *
 * A month. Long enough that a living owner will open their email, see the
 * notice in the app, or simply sign in; short enough that a grieving family
 * is not locked out of the photographs during the worst of it.
 */
export const NOTICE_DAYS = 30;

/** Days into the notice period on which the owner is written to again. */
export const REMIND_ON = [0, 3, 7, 14, 21, 27];

/**
 * How long is long enough to count as gone.
 *
 * Eighteen months, not twelve. A family whose whole ritual is one book a
 * year signs in around the anniversary and not much else, so a year of
 * quiet is a normal year. Eighteen months means they have missed the month
 * their book would have arrived, twice.
 */
export const SILENT_FOR_DAYS = 550;

export type ClaimStatus = "notice" | "completed" | "refused" | "withdrawn";
export type Opening = "claimed" | "silence";

export interface Claim {
  status: ClaimStatus;
  opening: Opening;
  /** When the notice period started. */
  openedAt: string;
  /** When it completes if nothing interrupts it. */
  decidesAt: string;
  /** The owner's last sign-in, or null if they have never signed in. */
  ownerSeenAt: string | null;
  /** Which reminder days have already been sent. */
  remindedOn: number[];
}

export type Move =
  | { do: "nothing" }
  | { do: "remind"; dayIntoNotice: number }
  | { do: "refuse"; because: "the owner signed in" }
  | { do: "hand over" };

const DAY = 86_400_000;
const at = (iso: string) => new Date(iso).getTime();
export const daysBetween = (from: string, to: string) => Math.floor((at(to) - at(from)) / DAY);

/** When a claim opened now would complete. */
export function decidesAtFor(openedAt: string): string {
  return new Date(at(openedAt) + NOTICE_DAYS * DAY).toISOString();
}

/**
 * What to do about one open claim, today.
 *
 * Ordering matters and is the whole safety property: the sign-of-life check
 * runs before the deadline check, so an owner who signs in on the last
 * morning still keeps their archive.
 */
export function next(claim: Claim, now: string): Move {
  if (claim.status !== "notice") return { do: "nothing" };

  // Signing in at any point during the notice is a refusal. Deliberately not
  // "signed in after we last looked" — it is measured against the moment the
  // claim opened, so a sweep that misses a day cannot let one through.
  if (claim.ownerSeenAt && at(claim.ownerSeenAt) > at(claim.openedAt)) {
    return { do: "refuse", because: "the owner signed in" };
  }

  if (at(now) >= at(claim.decidesAt)) return { do: "hand over" };

  // Reminders are looked up by how far into the notice we are, rather than
  // counted, so a sweep that runs twice in a day or not at all for three
  // days still sends each one exactly once.
  const day = daysBetween(claim.openedAt, now);
  const due = REMIND_ON.filter((d) => d <= day && !claim.remindedOn.includes(d));
  if (due.length) return { do: "remind", dayIntoNotice: Math.max(...due) };

  return { do: "nothing" };
}

export interface KeeperState {
  namedAt: string;
  /** A keeper who has said in advance that they would rather not. */
  declinedAt: string | null;
}

export type MayClaim =
  | { ok: true }
  | { ok: false; because: string };

/** Whether this keeper may open a claim right now. */
export function mayClaim(
  keeper: KeeperState,
  openClaims: number,
  now: string
): MayClaim {
  if (keeper.declinedAt) {
    return { ok: false, because: "you've said you'd rather not be asked to do this" };
  }
  if (openClaims > 0) {
    return { ok: false, because: "there's already a request open for this archive" };
  }
  const waited = daysBetween(keeper.namedAt, now);
  if (waited < SETTLING_DAYS) {
    return {
      ok: false,
      // Named rather than vague. Somebody in the middle of a bereavement
      // deserves a date, not "not yet".
      because:
        `this can be asked for from ${new Date(at(keeper.namedAt) + SETTLING_DAYS * DAY)
          .toISOString()
          .slice(0, 10)}, ${SETTLING_DAYS} days after you were named`,
    };
  }
  return { ok: true };
}

/**
 * Whether an archive has gone quiet for long enough to offer it to its
 * keeper without anybody having asked.
 *
 * Requires a keeper. An archive with nobody named simply waits — we do not
 * go looking for someone to hand a family's private life to, and an
 * unclaimed archive is not a problem that needs solving at anyone's expense
 * but ours.
 */
export function silenceOpens(input: {
  hasKeeper: boolean;
  ownerSeenAt: string | null;
  createdAt: string;
  openClaims: number;
  now: string;
}): boolean {
  if (!input.hasKeeper || input.openClaims > 0) return false;
  // Never seen is measured from when the archive was made, so an account
  // created and abandoned does not sit outside the rule for ever.
  const since = input.ownerSeenAt ?? input.createdAt;
  return daysBetween(since, input.now) >= SILENT_FOR_DAYS;
}
