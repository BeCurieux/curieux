// Is the host we are about to print actually somewhere?
//
// listenUrl() refuses to build a QR when NEXT_PUBLIC_APP_URL is unset. That
// closes the loudest hole and leaves the quiet one: a host that is *set* and
// wrong. A domain nobody has registered, a staging URL that will be recycled,
// localhost in a job runner's environment — each produces a perfectly valid
// QR code that scans to nothing, and none of them fails anywhere.
//
// The asymmetry is what justifies a network call in a print path. Every other
// preflight rule is about a file we can inspect. This one is about a promise
// the file makes to somebody holding it in nine years, and the only way to
// check it is to ask.
//
// What this proves and what it does not: resolution means the name is
// registered and delegated to nameservers. It does not prove the domain is
// *ours* — a name somebody else bought resolves perfectly well. That check
// does not exist in DNS, and pretending otherwise would be worse than saying
// so here.

/** Looks a hostname up. Injected so tests never touch the network. */
export type Resolver = (hostname: string) => Promise<boolean>;

export type HostCode = "ok" | "unset" | "malformed" | "unreachable" | "unresolved" | "insecure";

export interface HostVerdict {
  ok: boolean;
  code: HostCode;
  /** Written to be read by whoever has to fix it, not by a developer. */
  message: string;
  host?: string;
}

/**
 * Hosts that resolve, or fail to, but can never be reached by somebody
 * scanning a page. A book printed against any of these is waste paper.
 */
function unreachable(hostname: string): boolean {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return true;
  if (hostname === "127.0.0.1" || hostname === "::1" || hostname === "0.0.0.0") return true;
  // RFC1918 and link-local. A press file is not built on the network that
  // would make these mean anything.
  if (/^10\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  return false;
}

/**
 * Whether the configured host is fit to be printed into a book.
 *
 * Deliberately not called anywhere but the print path. The same host being
 * wrong on the website is a link somebody reports and we fix in a deploy.
 */
export async function checkPrintableHost(
  url: string | undefined,
  resolve: Resolver
): Promise<HostVerdict> {
  if (!url) {
    return {
      ok: false,
      code: "unset",
      message:
        "NEXT_PUBLIC_APP_URL is not set, so the QR codes in this book would " +
        "point nowhere. Set it to the address the codes should resolve to.",
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      ok: false,
      code: "malformed",
      message: `NEXT_PUBLIC_APP_URL is not a valid URL (${url}), so no printable address can be built from it.`,
    };
  }

  const host = parsed.hostname;

  if (unreachable(host)) {
    return {
      ok: false,
      code: "unreachable",
      host,
      message:
        `NEXT_PUBLIC_APP_URL points at ${host}, which is only reachable from ` +
        "the machine that built this file. A printed code has to work from a " +
        "phone in somebody's living room.",
    };
  }

  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      code: "insecure",
      host,
      message:
        `NEXT_PUBLIC_APP_URL uses ${parsed.protocol}//. These codes open a ` +
        "child's recording, and the address is printed permanently — it has " +
        "to be https.",
    };
  }

  if (!(await resolve(host))) {
    return {
      ok: false,
      code: "unresolved",
      host,
      message:
        `${host} does not resolve. If the domain has not been registered yet, ` +
        "every code in this book would be printed pointing at nothing — and " +
        "at a name somebody else can still buy.",
    };
  }

  return { ok: true, code: "ok", host, message: `${host} resolves.` };
}

/**
 * The verdict for this deployment.
 *
 * Reads the raw variable rather than homeUrl(), and that is the point: this
 * is the one caller that must be able to tell "unset" from "set to the
 * fallback". homeUrl() answers "where do we link to", where a sensible
 * default is a kindness. This answers "is it safe to print", where a default
 * is the bug — it would quietly turn a forgotten setting into a domain we may
 * not own yet, printed.
 */
export const printableHostFromEnv = (resolve: Resolver = dnsResolver): Promise<HostVerdict> =>
  checkPrintableHost(process.env.NEXT_PUBLIC_APP_URL, resolve);

/**
 * The real lookup. NS rather than A: a registered domain that has not been
 * pointed at a server yet still has nameservers, and that is the distinction
 * worth drawing — "not bought" is the failure being prevented, and a book is
 * printed weeks before it ships.
 */
export const dnsResolver: Resolver = async (hostname) => {
  const dns = await import("node:dns/promises");
  try {
    const ns = await dns.resolveNs(hostname);
    if (ns.length > 0) return true;
  } catch {
    // Fall through: a subdomain has no NS of its own, so ask for an address.
  }
  try {
    const a = await dns.resolve4(hostname);
    return a.length > 0;
  } catch {
    return false;
  }
};
