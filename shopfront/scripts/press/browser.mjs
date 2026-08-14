/**
 * Which Chromium to drive.
 *
 * Same order as `tests/visual/harness.ts`, for the same reason: an explicit
 * env var wins, then whatever `playwright install chromium` put in the
 * registry. The third entry is new — a container that ships a browser at a
 * fixed path with a revision the repo does not pin, where the registry answers
 * with a path that was never downloaded and the launch fails telling you to
 * run an install that is not the fix.
 */

import { chromium } from "playwright";
import { existsSync } from "node:fs";

export function chromiumPath() {
  const explicit = process.env.CHROMIUM_PATH ?? process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (explicit) return explicit;

  try {
    const resolved = chromium.executablePath();
    if (resolved && existsSync(resolved)) return resolved;
  } catch {
    // The registry has no answer for this platform; fall through.
  }

  const shipped = "/opt/pw-browsers/chromium";
  return existsSync(shipped) ? shipped : null;
}

export async function launch() {
  const executablePath = chromiumPath();
  if (!executablePath) {
    throw new Error("No Chromium. Run `pnpm exec playwright install chromium`, or set CHROMIUM_PATH.");
  }
  return chromium.launch({ executablePath, args: ["--no-sandbox"] });
}
