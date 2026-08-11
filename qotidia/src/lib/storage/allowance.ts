// How much room a family has.
//
// The product has never counted a byte. There is no size column on an asset
// and no total on a family, which means "unlimited" has been the implied
// offer since the first upload — and one household with four hundred
// gigabytes of 4K video costs more per year than they pay. That is the
// largest unmodelled liability in the business and it is invisible until it
// is expensive.
//
// The policy here is shaped by one commitment the product has already made
// and must not break: *we never delete a family's archive*. Everything below
// follows from taking that seriously.
//
//   **Being full never deletes anything.** Not after a month, not after a
//   year, not ever. A storage limit that eventually eats memories is not a
//   limit, it is a countdown, and no family should be asked to trust one.
//
//   **Being full never locks what is already there.** Reading, searching,
//   the weekly note, the books and the export all keep working. The only
//   thing that stops is adding more — which is the one thing that actually
//   costs us money.
//
//   **Nothing is refused halfway through an import.** A parent emptying a
//   camera roll should not be cut off at photo 400 of 600. There is room to
//   go over, and the warning comes early enough to act on.

/** Bytes in a gigabyte, decimal — the unit a storage bill is written in. */
export const GB = 1_000_000_000;

/**
 * What each plan includes.
 *
 * Not unlimited, and said out loud. Full-resolution family video grows
 * without bound and the honest version of this product charges for it rather
 * than quietly compressing somebody's memories to protect a margin.
 *
 * A hundred gigabytes is roughly twenty thousand phone photographs, or about
 * three hours of 4K video, or the mixture most families actually have. The
 * one-off plan gets less because it buys one year and one book rather than a
 * place to keep everything.
 */
export const INCLUDED: Record<string, number> = {
  monthly: 100 * GB,
  one_off: 50 * GB,
};

/** Sold in blocks, so the arithmetic on the bill is obvious. */
export const ADD_ON = 100 * GB;

/** Say something at four fifths, while there is still time to act. */
export const WARN_AT = 0.8;

/**
 * How far over the line an upload may still go.
 *
 * Ten per cent, and it exists so nobody is stopped in the middle of moving a
 * year of photographs across. The alternative — a hard edge at exactly 100%
 * — turns the best moment in the product, a parent finally emptying their
 * camera roll, into an error message.
 */
export const GRACE = 1.1;

export interface Allowance {
  usedBytes: number;
  includedBytes: number;
  /** Extra blocks the family has bought. */
  extraBytes: number;
  totalBytes: number;
  /** 0–1 and beyond; 1.04 means four per cent over. */
  fraction: number;
  /** Worth mentioning, but nothing is blocked. */
  warn: boolean;
  /** Over the line, including the grace. New uploads stop here. */
  full: boolean;
}

export function allowanceFor(input: {
  usedBytes: number;
  plan: string;
  extraBlocks?: number;
}): Allowance {
  const includedBytes = INCLUDED[input.plan] ?? INCLUDED.one_off;
  const extraBytes = Math.max(0, input.extraBlocks ?? 0) * ADD_ON;
  const totalBytes = includedBytes + extraBytes;
  const usedBytes = Math.max(0, input.usedBytes);
  const fraction = totalBytes === 0 ? 1 : usedBytes / totalBytes;

  return {
    usedBytes,
    includedBytes,
    extraBytes,
    totalBytes,
    fraction,
    warn: fraction >= WARN_AT,
    full: fraction >= GRACE,
  };
}

export interface Room {
  ok: boolean;
  /** What to say. Null when there is nothing to say. */
  message: string | null;
  /** True when this upload is what tips them into the warning. */
  nowWarning: boolean;
}

/**
 * Whether an upload fits, and what to tell them.
 *
 * The refusal names the number, says what still works, and offers the way
 * out. A storage error that says "quota exceeded" and stops is a company
 * telling a family their memories are a capacity-planning problem.
 */
export function roomFor(allowance: Allowance, incomingBytes: number): Room {
  const after = allowance.usedBytes + Math.max(0, incomingBytes);
  const limit = allowance.totalBytes * GRACE;

  if (after > limit) {
    return {
      ok: false,
      message:
        `You've used ${asSize(allowance.usedBytes)} of ${asSize(allowance.totalBytes)}. ` +
        `Everything you've kept stays exactly where it is and still works — ` +
        `we just can't take anything new until there's room. ` +
        `Adding ${asSize(ADD_ON)} sorts it.`,
      nowWarning: false,
    };
  }

  const wasWarning = allowance.warn;
  const nowWarning = after / allowance.totalBytes >= WARN_AT;

  return {
    ok: true,
    message:
      nowWarning && !wasWarning
        ? `That takes you to ${asSize(after)} of ${asSize(allowance.totalBytes)}. ` +
          `Worth knowing before the next big upload.`
        : null,
    nowWarning: nowWarning && !wasWarning,
  };
}

/**
 * A size a person can read.
 *
 * Decimal units, because that is what a storage bill and every phone use.
 * Whole numbers above ten, one decimal below — "1.4 GB" is useful and
 * "1.42 GB" is noise.
 */
export function asSize(bytes: number): string {
  const units: [number, string][] = [
    [GB, "GB"],
    [1_000_000, "MB"],
    [1_000, "KB"],
  ];
  for (const [size, label] of units) {
    if (bytes >= size) {
      const n = bytes / size;
      return `${n >= 10 ? Math.round(n) : Math.round(n * 10) / 10} ${label}`;
    }
  }
  return `${Math.max(0, Math.round(bytes))} bytes`;
}
