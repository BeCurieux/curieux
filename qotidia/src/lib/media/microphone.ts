// Asking for the microphone, and what to do when the answer is no.
//
// This is the only browser permission the product asks for. There is no
// geolocation, no push, no contacts, no camera — which is itself the first
// rule of gradual permissions and the one most products break: the cheapest
// way to never mishandle a permission is not to want it.
//
// The one we do want is worth getting right, because of an asymmetry people
// underestimate. A microphone prompt is not a question with two answers. It
// has three: yes, not now, and **no, and stop asking** — and browsers reach
// the third quickly, from a single dismissal in some, and then refuse to
// prompt again for that site. A "no" costs a family the one thing in this
// archive that genuinely cannot be recovered later. You can photograph a
// six-year-old. You cannot record a three-year-old next year.
//
// So:
//
//   **Explain before the browser asks, not after.** The browser's dialog has
//   room for a hostname. Everything a parent needs in order to say yes has
//   to be on the page above it, already read.
//
//   **Never on load.** A prompt nobody asked for is the single strongest
//   predictor of a permanent block, and it takes the feature away for good.
//
//   **Read the state without asking for it.** permissions.query() never
//   prompts. Where a browser supports it we can know we have been blocked
//   and show the way back, instead of offering a button that silently does
//   nothing.
//
//   **"Try again" is a lie once blocked.** The old copy said exactly that.
//   Retrying a blocked permission does not re-prompt; it fails instantly and
//   identically, which teaches a parent the feature is broken. Blocked needs
//   directions, not a button.

/** Where we stand with the microphone, without having asked. */
export type MicState =
  | "unasked"
  /** Granted, or granted previously and remembered. */
  | "ready"
  /** Refused, and the browser will not ask again until a person changes it. */
  | "blocked"
  /** Asked and dismissed. Asking once more is legitimate. */
  | "dismissed"
  /** No microphone on the device. */
  | "absent"
  /** There is one, and something else has it. */
  | "busy"
  /** No getUserMedia at all — an old browser, or not a secure origin. */
  | "unsupported";

/**
 * What a failed getUserMedia actually meant.
 *
 * The names are DOMException's, and the distinction that matters most is
 * blocked vs dismissed: they arrive as the same NotAllowedError, and only
 * a permissions.query() afterwards can tell them apart. Callers that cannot
 * query should treat NotAllowedError as blocked — offering directions to
 * somebody who merely dismissed costs them one extra sentence, while
 * offering a dead button to somebody who is blocked costs them the feature.
 */
export function readError(err: unknown): MicState {
  const name = (err as { name?: string })?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "blocked";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "absent";
    case "NotReadableError":
    case "TrackStartError":
      return "busy";
    case "SecurityError":
      return "unsupported";
    default:
      // A TypeError here is navigator.mediaDevices being undefined, which
      // is what an insecure origin looks like from inside the page.
      return err instanceof TypeError ? "unsupported" : "blocked";
  }
}

export interface Says {
  /** What happened, in the second person. */
  what: string;
  /** What to do about it, or null when there is nothing to be done. */
  next: string | null;
  /** Whether offering the button again could possibly work. */
  retryable: boolean;
}

/**
 * What we tell them.
 *
 * Every one of these ends somewhere. The failure this replaces was a single
 * sentence for all five cases that told a blocked person to try again —
 * which is a dead end dressed as a next step, and the way a parent decides a
 * product is broken rather than that they are two taps from fixing it.
 */
export const SAYS: Record<Exclude<MicState, "unasked" | "ready">, Says> = {
  blocked: {
    what: "Your browser is holding a no for this site, so it won't ask again on its own.",
    // Kept browser-agnostic on purpose. Naming Chrome's exact menu path is
    // wrong for half the readers and out of date for the rest; the padlock
    // is in the same place in every browser that has one.
    next: "Tap the padlock or the settings icon beside the address, allow the microphone, then come back to this page.",
    retryable: false,
  },
  dismissed: {
    what: "That prompt got closed before it was answered.",
    next: "Have another go — the browser will ask once more.",
    retryable: true,
  },
  absent: {
    what: "This device doesn't seem to have a microphone we can reach.",
    next: "A phone is usually the easiest thing to record on, if you have one nearby.",
    retryable: true,
  },
  busy: {
    what: "Something else on this device is using the microphone.",
    next: "Close whatever is on a call and try again.",
    retryable: true,
  },
  unsupported: {
    what: "This browser can't record here.",
    next: "Recording needs a secure connection and a fairly current browser. Everything else on this page works regardless.",
    retryable: false,
  },
};

/**
 * The sentence shown before the browser asks.
 *
 * Three facts, in the order a nervous person needs them: what it is for,
 * that nothing leaves the device until they decide, and that refusing costs
 * them nothing else. The third is what makes it a request rather than a
 * toll gate, and it is true — every other way of adding a memory still
 * works.
 */
export const BEFORE_ASKING =
  "Your browser will ask for the microphone. Nothing is sent anywhere while " +
  "you record — it stays on this device until you listen back and decide to " +
  "keep it. If you'd rather not, nothing else here changes.";

/** Whether recording is possible at all in this browser, without asking. */
export function canRecord(nav: unknown = typeof navigator === "undefined" ? undefined : navigator): boolean {
  const media = (nav as { mediaDevices?: { getUserMedia?: unknown } })?.mediaDevices;
  return typeof media?.getUserMedia === "function";
}

/**
 * What the browser already knows, without prompting.
 *
 * permissions.query() does not ask the person anything — it reads a decision
 * they may have made before. Safari does not implement it for microphone and
 * throws on the name, so every path here returns "unasked" rather than
 * guessing; an unknown state must never be rendered as a refusal.
 */
export async function currentState(nav: unknown = typeof navigator === "undefined" ? undefined : navigator): Promise<MicState> {
  if (!canRecord(nav)) return "unsupported";
  const perms = (nav as { permissions?: { query?: (d: { name: string }) => Promise<{ state: string }> } })?.permissions;
  if (typeof perms?.query !== "function") return "unasked";
  try {
    const status = await perms.query({ name: "microphone" });
    if (status.state === "granted") return "ready";
    if (status.state === "denied") return "blocked";
    return "unasked";
  } catch {
    return "unasked";
  }
}
