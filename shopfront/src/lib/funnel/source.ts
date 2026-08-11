/**
 * Where a session came from, coarsely.
 *
 * The brief's honest moat claim is that audience context — where the session
 * came from, what the creator said, what the merchant declared — lives at this
 * layer and nowhere else. This is the smallest useful version of that: which
 * platform the click came off, from the referrer the browser already sent.
 *
 * Coarse on purpose. "instagram" is the fact a merchant acts on; the full
 * referring URL adds nothing to that decision and quite a lot to what has to be
 * defended in a privacy policy. Recording less than the browser offered is a
 * feature.
 */

import { TRAFFIC_SOURCES, type TrafficSource } from "./types";

/** Host fragments → source. Ordered: the first match wins. */
const HOSTS: [RegExp, TrafficSource][] = [
  [/(^|\.)instagram\.com$|(^|\.)ig\.me$|(^|\.)l\.instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$|(^|\.)vm\.tiktok\.com$/, "tiktok"],
  [/(^|\.)threads\.(net|com)$/, "threads"],
  [/(^|\.)facebook\.com$|(^|\.)fb\.(me|com)$|(^|\.)l\.facebook\.com$/, "facebook"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)pinterest\.[a-z.]+$|(^|\.)pin\.it$/, "pinterest"],
  [/(^|\.)(twitter|x)\.com$|(^|\.)t\.co$/, "x"],
  [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, "linkedin"],
  [/(^|\.)snapchat\.com$/, "snapchat"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)whatsapp\.com$|(^|\.)wa\.me$/, "whatsapp"],
  [/(^|\.)(google|bing|duckduckgo|ecosia|yahoo|baidu|yandex)\.[a-z.]+$/, "search"],
  [/(^|\.)(mail|outlook|gmail)\.[a-z.]+$/, "email"],
];

/** UTM values merchants actually type, mapped onto the closed set. */
const UTM: Record<string, TrafficSource> = {
  ig: "instagram",
  insta: "instagram",
  instagram: "instagram",
  tiktok: "tiktok",
  tt: "tiktok",
  fb: "facebook",
  facebook: "facebook",
  meta: "facebook",
  yt: "youtube",
  youtube: "youtube",
  pinterest: "pinterest",
  twitter: "x",
  x: "x",
  linkedin: "linkedin",
  snapchat: "snapchat",
  reddit: "reddit",
  threads: "threads",
  whatsapp: "whatsapp",
  email: "email",
  newsletter: "email",
  klaviyo: "email",
  google: "search",
  search: "search",
  bio: "instagram",
  linkinbio: "instagram",
};

export interface ReadSourceInput {
  referrer?: string | null;
  /** `utm_source` from the shop URL, if present. */
  utmSource?: string | null;
  /** The page's own origin, so a same-site navigation is not a "referral". */
  selfOrigin?: string | null;
}

/**
 * The merchant's own tag wins over the referrer.
 *
 * A `utm_source` is a statement of intent — the merchant put that link in that
 * bio on purpose — where a referrer is whatever the browser felt like sending.
 * In-app browsers routinely send nothing at all, which is exactly the traffic
 * this product is for, so the tag is the more reliable signal as well as the
 * more meaningful one.
 */
export function readSource({ referrer, utmSource, selfOrigin }: ReadSourceInput): TrafficSource {
  const tagged = utmSource?.trim().toLowerCase();
  if (tagged) {
    if (UTM[tagged]) return UTM[tagged];
    // A tag we do not recognise is still a tag: the merchant meant something by
    // it, so it is "other" rather than "direct".
    return "other";
  }

  if (!referrer) return "direct";

  let host: string;
  let origin: string;
  try {
    const url = new URL(referrer);
    host = url.hostname.toLowerCase();
    origin = url.origin;
  } catch {
    return "other";
  }

  // A shopper moving inside the same shop did not arrive from anywhere.
  if (selfOrigin && origin === selfOrigin) return "direct";

  for (const [pattern, source] of HOSTS) {
    if (pattern.test(host)) return source;
  }
  return "other";
}

export function isTrafficSource(value: unknown): value is TrafficSource {
  return typeof value === "string" && (TRAFFIC_SOURCES as readonly string[]).includes(value);
}
