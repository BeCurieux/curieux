// Public playback for a printed QR code.
//
// No account, no session — whoever holds the book can scan it. Access is
// bounded three ways: the token only exists once a book is approved for
// print, it reaches only the recordings printed in that book, and the audio
// itself is served through a signed URL that expires in ten minutes.

import { notFound } from "next/navigation";
import { adminClient } from "@/lib/supabase/server";
import { getObjectStore, TTL } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";

export default async function ListenPage(
  props: {
    params: Promise<{ token: string; memoryId: string }>;
  }
) {
  const params = await props.params;
  const db = adminClient();

  // The security-definer function is the only door: it answers for this
  // token alone, and only for a voice memory actually printed in that book.
  const { data, error } = await db.rpc("resolve_listen", {
    token: params.token,
    mid: params.memoryId,
  });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) notFound();

  let audioUrl: string;
  try {
    audioUrl = await getObjectStore().readUrl("media", row.storage_path, TTL.listen);
  } catch {
    notFound();
  }

  return (
    <div className="mx-auto !max-w-md py-20 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-ochre">
        From {row.book_title}
      </p>

      {row.transcript ? (
        <blockquote className="mt-8 font-display text-3xl leading-snug">
          &ldquo;{row.transcript}&rdquo;
        </blockquote>
      ) : (
        <h1 className="mt-8 font-display text-3xl">{row.subject_name}</h1>
      )}

      {row.memory_date && (
        <p className="mt-3 text-sm text-stone">
          {row.subject_name} · {row.memory_date}
        </p>
      )}

      <audio
        controls
        autoPlay
        src={audioUrl}
        className="mt-10 w-full"
        aria-label={`Recording of ${row.subject_name}`}
      />

      <p className="mt-12 text-xs leading-relaxed text-stone">
        This recording belongs to the family who made this book. It is not
        listed or searchable anywhere, and this link expires.
      </p>
    </div>
  );
}
