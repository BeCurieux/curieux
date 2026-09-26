/**
 * Where the labelling form posts.
 *
 * A plain form post, answered with a 303 back to the page. That keeps the
 * labelling page free of JavaScript, and it means a refresh after saving
 * cannot re-submit.
 *
 * Every dimension that validates is saved, even when another does not. The
 * labeller is sent back to the same product with the problem named, and the
 * answers already saved are pre-filled. Throwing away six good answers
 * because of one missing radio button would be a cost paid by the person
 * building the gold set, for nothing.
 *
 * The token is checked here as well as on the page. The page is not what
 * authorises a write; this route is.
 */

import { NextResponse } from "next/server";
import { hashToken, LabelError, plausibleToken, validateLabel } from "@/lib/genome/v1/gold";
import { defaultGenomeV1Store } from "@/lib/genome/v1/store";
import { MODEL_DIMENSIONS, TAXONOMY_VERSION } from "@/lib/genome/v1/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Seven dimensions of short enum values; anything bigger is not this form. */
const MAX_BYTES = 8_000;

export async function POST(request: Request): Promise<Response> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) return new Response("Too large.", { status: 413 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new Response("Could not read that.", { status: 400 });
  }

  const token = String(form.get("token") ?? "");
  const itemId = String(form.get("item") ?? "");
  if (!plausibleToken(token)) return new Response("Not found.", { status: 404 });

  const store = await defaultGenomeV1Store();
  const labeller = await store.findLabeller(hashToken(token));
  if (!labeller) return new Response("Not found.", { status: 404 });

  const items = await store.listGoldItems();
  const index = items.findIndex((i) => i.id === itemId);
  if (index === -1) return new Response("No such product.", { status: 404 });

  const problems: string[] = [];
  const now = new Date().toISOString();
  for (const dim of MODEL_DIMENSIONS) {
    try {
      const { dimension, labels } = validateLabel(dim, form.getAll(dim).map(String));
      await store.saveLabel({ itemId, labellerId: labeller.id, dimension, labels, taxonomyVersion: TAXONOMY_VERSION, labelledAt: now });
    } catch (error) {
      if (!(error instanceof LabelError)) throw error;
      problems.push(error.message);
    }
  }

  const back = new URL(`/label/${token}`, request.url);
  if (problems.length) {
    back.searchParams.set("item", itemId);
    back.searchParams.set("error", problems.join(" "));
  } else {
    back.searchParams.set("saved", "1");
  }
  return NextResponse.redirect(back, 303);
}
