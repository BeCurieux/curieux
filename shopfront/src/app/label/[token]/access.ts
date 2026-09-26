/**
 * Who is labelling, from the invite link.
 *
 * The token in the URL is the only credential: it is hashed and looked up,
 * never stored or logged. An unknown or revoked token is a 404, not a login
 * prompt. There is nothing to log in to, and a page that says "this link
 * is not valid" to anyone guessing is a page that confirms the route exists.
 */

import { notFound } from "next/navigation";
import { hashToken, plausibleToken } from "@/lib/genome/v1/gold";
import { defaultGenomeV1Store, type GenomeV1Store, type Labeller } from "@/lib/genome/v1/store";

export async function labellerFor(token: string): Promise<{ store: GenomeV1Store; labeller: Labeller }> {
  if (!plausibleToken(token)) notFound();
  const store = await defaultGenomeV1Store();
  const labeller = await store.findLabeller(hashToken(token));
  if (!labeller) notFound();
  return { store, labeller };
}

/**
 * The invite token sits in the URL, so no page under it may tell another site
 * where the reader came from. Product photographs load from merchants' CDNs,
 * and a default referrer policy would hand every one of them a working link.
 */
export const PRIVATE_PAGE = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
