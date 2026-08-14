/**
 * Whether the workbench at `/workbench` is a page or a 404.
 *
 * It is a development tool: it lists everything generated so far, reads the
 * local shop cache, and shows the command that fills it. That is exactly what
 * is wanted on a laptop and exactly what should not be reachable on the domain
 * a merchant was handed a link on. In a deployment the cache does not
 * exist either, so the page it would render is an empty dev tool with a
 * terminal command in it — nothing leaks, but nothing is gained.
 *
 * Gated on `NODE_ENV` rather than on Vercel's own variables, because the
 * question is "is this a production build" and not "is this Vercel". A
 * self-hosted `next start`, a preview deployment and a production deployment
 * are all builds a stranger might open; `next dev` is the only one that is not.
 *
 * `WORKBENCH=1` turns it back on for a deployed build, which is the case this
 * would otherwise make impossible: comparing five moods on a preview URL
 * rather than on the machine that generated them. It is opt-in, per
 * deployment, and cannot happen by forgetting something.
 */

export interface WorkbenchEnv {
  NODE_ENV?: string | undefined;
  WORKBENCH?: string | undefined;
}

/** The set `WORKBENCH` accepts, so that `WORKBENCH=false` does not read as true. */
const ON = new Set(["1", "true", "yes", "on"]);

export function workbenchVisible(env: WorkbenchEnv = process.env): boolean {
  if (env.WORKBENCH !== undefined) return ON.has(env.WORKBENCH.trim().toLowerCase());
  return env.NODE_ENV !== "production";
}
