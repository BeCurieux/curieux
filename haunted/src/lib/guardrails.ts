// Guardrail 2 — cozy, never creepy (CLAUDE.md). Two layers:
//   Layer 2a: deterministic reject — fast, runs on EVERY generated line.
//   Layer 2b: a single cheap classifier call — COZY vs CREEPY.
// An unvalidated line is never sent. The classifier is injected so the engine
// and tests share ONE code path (tests pass a deterministic stub).

// Fast, deterministic reject. The item may only speak about itself; anything
// about watching, tracking, or the reader's body/home/schedule is out.
export const BANNED: RegExp[] = [
  /\b(watch|watching|watched)\b/i,
  // observing the reader: see/saw/seen/seeing you
  /\b(see|saw|seen|seeing) you\b/i,
  /\b(aware|i know (where|what|when) you)\b/i,
  /\b(follow|following|track|tracking|behind you)\b/i,
  // the reader's private space/body/schedule (incl. room/bedroom)
  /\byour (home|house|room|bedroom|door|bed|window|body|phone|schedule)\b/i,
  /\b(can't escape|cannot escape|no escape|always here|never leave you)\b/i,
];

export function passesDeterministic(line: string): boolean {
  if (line.length > 120) return false;
  return !BANNED.some((rx) => rx.test(line));
}

export type SafetyVerdict = 'COZY' | 'CREEPY';

// The classifier boundary. Real impl calls Haiku; tests inject a stub. It must
// return exactly one verdict; callers treat anything non-COZY as a reject.
export interface SafetyClassifier {
  classify(line: string): Promise<SafetyVerdict>;
}

// Full Layer-2 validation for one candidate line: deterministic first (cheap,
// no network), then the classifier only if it survives. Returns a structured
// result so the caller can log the precise reason to haunt_events.
export interface ValidationResult {
  ok: boolean;
  reason: 'passed' | 'deterministic' | 'classifier';
}

export async function validateLine(
  line: string,
  classifier: SafetyClassifier,
): Promise<ValidationResult> {
  const trimmed = line.trim();
  if (!passesDeterministic(trimmed)) {
    return { ok: false, reason: 'deterministic' };
  }
  const verdict = await classifier.classify(trimmed);
  if (verdict !== 'COZY') {
    return { ok: false, reason: 'classifier' };
  }
  return { ok: true, reason: 'passed' };
}
