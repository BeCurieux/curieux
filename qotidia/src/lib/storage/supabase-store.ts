// The store we have today.
//
// This is the current behaviour, moved behind the interface and otherwise
// left alone. It stays the default so that adopting the seam changes
// nothing: the same buckets, the same signed URLs, the same expiry.
//
// The one thing that is genuinely new is writeTicket. Browser uploads used
// to go through the Supabase client with row-level security on the bucket
// deciding whether they were allowed. That cannot survive a move — R2 has no
// RLS — so uploads now go to a URL the server mints after checking
// permission itself. The endpoint and headers below are exactly what
// supabase-js's own uploadToSignedUrl sends; they were read out of the
// shipped library rather than guessed, because "PUT or POST" is the sort of
// detail that is obvious in hindsight and invisible in review.

import { adminClient } from "@/lib/supabase/server";
import { projectUrl } from "@/lib/supabase/keys";
import type { Bucket, ObjectStore, WriteTicket } from "./provider";

export class SupabaseStore implements ObjectStore {
  readonly name = "supabase";

  async readUrl(
    bucket: Bucket,
    key: string,
    ttlSeconds: number,
    opts?: { downloadAs?: string }
  ): Promise<string> {
    const { data, error } = await adminClient()
      .storage.from(bucket)
      .createSignedUrl(key, ttlSeconds, opts?.downloadAs ? { download: opts.downloadAs } : undefined);
    if (error || !data?.signedUrl) {
      throw new Error(`could not sign ${bucket}/${key}: ${error?.message ?? "no url returned"}`);
    }
    return data.signedUrl;
  }

  async writeTicket(
    bucket: Bucket,
    key: string,
    _ttlSeconds: number,
    opts: { contentType: string; contentLength: number }
  ): Promise<WriteTicket> {
    // Supabase decides the lifetime of an upload token itself; ttl is
    // accepted and ignored rather than being absent from the interface,
    // because R2 does honour it and the call sites should not have to know
    // which provider they are talking to.
    const { data, error } = await adminClient()
      .storage.from(bucket)
      .createSignedUploadUrl(key, { upsert: true });
    if (error || !data?.signedUrl) {
      throw new Error(`could not sign an upload for ${bucket}/${key}: ${error?.message ?? "no url"}`);
    }

    // createSignedUploadUrl returns an absolute URL in current supabase-js
    // and a project-relative one in older versions. Normalised here so a
    // dependency bump cannot quietly produce a URL the browser posts to
    // itself.
    const url = data.signedUrl.startsWith("http")
      ? data.signedUrl
      : `${projectUrl()}/storage/v1${data.signedUrl}`;

    return {
      url,
      method: "PUT",
      headers: {
        "content-type": opts.contentType,
        "x-upsert": "true",
        // Not signed here — Supabase has no way to bind it. The server-side
        // quota check in registerUploadedPhoto is what actually holds under
        // this provider. Sent anyway so the two providers behave the same
        // from the browser's side.
        "cache-control": "max-age=3600",
      },
    };
  }

  async put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await adminClient()
      .storage.from(bucket)
      .upload(key, body, { contentType, upsert: true });
    if (error) throw new Error(`could not write ${bucket}/${key}: ${error.message}`);
  }

  async get(bucket: Bucket, key: string): Promise<Buffer> {
    const { data, error } = await adminClient().storage.from(bucket).download(key);
    if (error || !data) {
      throw new Error(`could not read ${bucket}/${key}: ${error?.message ?? "not found"}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async remove(bucket: Bucket, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    // Batched: erase.ts deletes a whole family's archive, which can be tens
    // of thousands of objects, and the API takes a list rather than a page.
    for (let i = 0; i < keys.length; i += 100) {
      await adminClient().storage.from(bucket).remove(keys.slice(i, i + 100));
    }
  }
}
