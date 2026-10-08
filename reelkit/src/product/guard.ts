/**
 * The server fetches a URL a stranger typed in. Without this file, that is a
 * way to make our server read its own cloud metadata endpoint, or anything
 * else on a private network, and hand the answer back.
 *
 * Every hop is checked, redirects included: a public URL that 302s to
 * 169.254.169.254 is the classic way around a check made only once.
 *
 * Known gap: the check resolves the name, then `fetch` resolves it again.
 * A host that answers differently the second time (DNS rebinding) gets
 * through. Closing that needs pinning the checked address into the
 * connection, which the platform `fetch` does not offer; it is the next step
 * if this endpoint ever fetches anything more sensitive than a product page.
 */

export type Lookup = (host: string) => Promise<string[]>;

export class BlockedAddress extends Error {}

function v4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const n = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return n.every((x) => x >= 0 && x <= 255) ? n : null;
}

function privateV4([a, b]: number[]): boolean {
  if (a === undefined || b === undefined) return true;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateAddress(ip: string): boolean {
  const addr = ip.replace(/^\[|\]$/g, "").toLowerCase();
  const four = v4(addr);
  if (four) return privateV4(four);
  if (!addr.includes(":")) return true; // not an address we understand: refuse

  // IPv4-mapped and -translated forms carry a v4 address in the low bits.
  const mapped = addr.match(/^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateAddress(mapped[1]);
  const mappedHex = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex?.[1] && mappedHex[2]) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return privateV4([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  }

  if (addr === "::" || addr === "::1") return true;
  const first = parseInt(addr.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 || // fc00::/7 unique local
    (first & 0xffc0) === 0xfe80 || // fe80::/10 link local
    (first & 0xff00) === 0xff00 // multicast
  );
}

export async function assertPublicUrl(raw: string, lookup: Lookup): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BlockedAddress(`Refusing a ${url.protocol} URL.`);
  }
  if (url.username || url.password) throw new BlockedAddress("Refusing a URL with credentials in it.");
  if (url.port && url.port !== "443" && url.port !== "80") {
    throw new BlockedAddress("Refusing a non-standard port.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new BlockedAddress("Refusing a private host.");
  }
  const literal = v4(host) || host.includes(":");
  const addresses = literal ? [host] : await lookup(host);
  if (addresses.length === 0) throw new BlockedAddress(`${host} does not resolve.`);
  if (addresses.some(isPrivateAddress)) throw new BlockedAddress("Refusing a private address.");
  return url;
}
