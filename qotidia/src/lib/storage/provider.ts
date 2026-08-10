// Where the bytes live.
//
// Everything in this product that touches a photograph, a voice note or a
// rendered book goes through this interface and not through a vendor's
// client. There were fourteen places reaching into `db.storage.from(...)`
// directly, which meant the answer to "where do we keep families'
// photographs" was spread across job handlers, route handlers, an export
// builder and two React components.
//
// ## Why this exists
//
// Storage is the one part of the stack with an argument for moving that is
// about money rather than taste. Per-gigabyte prices between providers are
// close; egress is not. Serving a family their own archive — every page
// view, every book render, every export — is metered on most object stores
// and free on some, and it scales with how much people *use* the product
// rather than how much they store. A product whose whole promise is "come
// back to this for eighteen years" should not have a cost line that grows
// every time somebody does.
//
// So: one interface, three implementations, chosen by an environment
// variable. Moving providers becomes a deployment decision rather than a
// project.
//
// ## What an implementation must promise
//
//   **Nothing is ever public.** There is no getPublicUrl here and there must
//   never be one. Every read is a signed URL that stops working, and the
//   default expiry is minutes rather than days.
//
//   **The store is not the access check.** Supabase had row-level security
//   on the bucket; R2 has none. Neither is load-bearing. Permission is
//   decided in the application, against the database, before a URL is
//   minted — which is the only version that is true under both providers.
//
//   **Keys are opaque.** No implementation may parse a key to decide
//   anything. The path layout is the application's business.

import { MemoryStore } from "./memory";
import { R2Store } from "./r2";
import { SupabaseStore } from "./supabase-store";

/**
 * The two buckets. Not a string, so a typo cannot invent a third one that
 * silently holds somebody's photographs where nothing looks for them.
 *
 *   media   — what families upload. Originals and derivatives.
 *   renders — what we generate. Book PDFs, export archives.
 */
export type Bucket = "media" | "renders";

export const BUCKETS: Bucket[] = ["media", "renders"];

/** Everything a browser needs to send one file, and nothing more. */
export interface WriteTicket {
  url: string;
  method: "PUT";
  /** Send exactly these. On R2 they are signed, so changing one is refused. */
  headers: Record<string, string>;
}

export interface ObjectStore {
  readonly name: string;

  /**
   * A URL that reads one object and then stops working.
   *
   * `downloadAs` sets a filename and makes the browser save rather than
   * display it — used for the archive export, where the alternative is a
   * 400MB zip rendered as text.
   */
  readUrl(
    bucket: Bucket,
    key: string,
    ttlSeconds: number,
    opts?: { downloadAs?: string }
  ): Promise<string>;

  /**
   * A URL a browser may PUT one file to.
   *
   * contentLength is required rather than optional, and that is deliberate.
   * A provider that can bind it — R2 signs it — turns the size a browser
   * *claims* into the size it is *allowed* to send, which is what makes the
   * storage quota an actual limit instead of an honour system. A provider
   * that cannot bind it still gets told, so the day we move, the call sites
   * already pass the right number.
   */
  writeTicket(
    bucket: Bucket,
    key: string,
    ttlSeconds: number,
    opts: { contentType: string; contentLength: number }
  ): Promise<WriteTicket>;

  /** Server-side write, for things we generate ourselves. */
  put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void>;

  /** Server-side read. Throws if the object is not there. */
  get(bucket: Bucket, key: string): Promise<Buffer>;

  /** Delete. Missing keys are not an error — deleting twice must be safe. */
  remove(bucket: Bucket, keys: string[]): Promise<void>;
}

let cached: ObjectStore | null = null;

/**
 * Which store is in use.
 *
 * Defaults to Supabase, so nothing changes for an existing deployment until
 * somebody sets the variable. Demo mode gets the in-memory one, because the
 * whole point of demo mode is that it provisions nothing.
 */
export function getObjectStore(): ObjectStore {
  if (cached) return cached;
  // `||`, so a blank STORAGE_PROVIDER= in a half-filled .env falls through
  // to the default rather than selecting a provider named "".
  const chosen = process.env.STORAGE_PROVIDER || (process.env.DEMO_MODE === "1" ? "memory" : "supabase");

  if (chosen === "r2") cached = new R2Store();
  else if (chosen === "memory") cached = new MemoryStore();
  else cached = new SupabaseStore();
  return cached;
}

/** Test seam, and the thing that makes provider choice switchable at runtime. */
export function setObjectStore(store: ObjectStore | null): void {
  cached = store;
}

/**
 * How long a read URL lives.
 *
 * Short by default. These end up in HTML, in browser history and in server
 * logs, and a URL that outlives the page it was minted for is a link to a
 * child's photograph sitting in somebody's cache.
 *
 * The long ones are the exceptions worth naming: a book render hands URLs to
 * a printer that fetches them on its own schedule, and an export is a file a
 * parent may start downloading and finish over lunch.
 */
export const TTL = {
  /** An image on a page the parent is looking at right now. */
  view: 300,
  /** A file being downloaded, which may be large and slow. */
  download: 300,
  /**
   * How long a browser has to send one file.
   *
   * Generous, because it has to cover the slowest realistic case: a parent
   * on hotel wifi pushing a 200MB video. A ticket that expires mid-transfer
   * fails at the end of the upload, which is the most expensive moment to
   * fail at.
   */
  upload: 3600,
  /** Handed to the print provider, fetched whenever they get to it. */
  print: 3600,
  /** Read during a render we are running ourselves. */
  render: 900,
  /**
   * A recording reached by scanning the QR code printed in a book.
   *
   * The only read in the product with no login behind it, which is why it
   * is the shortest: whoever is holding the book gets long enough to press
   * play, and the URL is useless by the time it could be shared.
   */
  listen: 600,
} as const;
