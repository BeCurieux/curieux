"use client";

// Voice memories (brief §6, §7).
// Records in the browser, uploads to the same private bucket as photographs,
// and stores the parent's own transcription alongside it. The transcript is
// what gets printed; the recording is what gets heard.
//
// This is the only place in the product that asks the browser for anything,
// and the asking is done carefully — see lib/media/microphone.ts for why a
// microphone "no" is more expensive here than almost anywhere else. Three
// things follow from it and are easy to undo by accident:
//
//   getUserMedia is called from a tap and never on mount.
//   The reason is on the page before the browser's dialog, not after it.
//   A blocked permission gets directions, not a button that cannot work.

import { useCallback, useEffect, useRef, useState } from "react";
import { registerVoiceMemory, uploadTicket } from "@/app/actions";
import { BEFORE_ASKING, SAYS, currentState, readError, type MicState } from "@/lib/media/microphone";

type Phase = "idle" | "recording" | "review" | "saving" | "saved";

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * What a rejection meant, resolved as far as the browser will allow.
 *
 * NotAllowedError covers both "closed the dialog" and "told it no,
 * permanently", and they need opposite advice: one is a button, the other is
 * directions to a setting. Chrome and Firefox will say which via
 * permissions.query(); Safari will not, so there the second refusal is taken
 * as the real one — a parent who genuinely dismissed once gets one extra tap,
 * which is much cheaper than a blocked parent getting a button that cannot
 * work.
 */
async function settle(err: unknown, asks: number): Promise<MicState> {
  const guess = readError(err);
  if (guess !== "blocked") return guess;
  const known = await currentState();
  if (known === "blocked") return "blocked";
  return asks > 1 ? "blocked" : "dismissed";
}

export function Recorder({ subjectId }: { subjectId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // What the browser already thinks, read without prompting.
  const [mic, setMic] = useState<MicState>("unasked");
  /** How many times we have prompted. Tells a closed dialog from a block. */
  const [asks, setAsks] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read-only. permissions.query() never prompts, which is the whole reason
  // it is safe to run here: it lets a blocked person see the way back before
  // they tap a button that would fail silently.
  useEffect(() => {
    let live = true;
    void currentState().then((state) => live && setMic(state));
    return () => {
      live = false;
    };
  }, []);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = useCallback(async () => {
    setError(null);
    // Counted in state, not a ref. The button's wording depends on whether
    // we have asked before, and a ref does not re-render — so the label
    // could still read "Start recording" after a refusal. The local `asked`
    // is what this attempt is, which is what settle() has to judge.
    const asked = asks + 1;
    setAsks(asked);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase("review");
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setMic(await settle(err, asked));
    }
  }, [asks]);

  const stop = useCallback(() => {
    stopTimer();
    recorderRef.current?.stop();
  }, []);

  const discard = useCallback(() => {
    blobRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSeconds(0);
    setPhase("idle");
  }, [previewUrl]);

  const save = useCallback(
    async (formData: FormData) => {
      const blob = blobRef.current;
      if (!blob) return;
      setPhase("saving");
      setError(null);
      try {
        const buf = await blob.arrayBuffer();
        const checksum = await sha256Hex(buf);

        // Same route as a photograph: the server decides the path, checks
        // the family has room, and hands back a URL good for this one file.
        const ticket = await uploadTicket({
          subjectId,
          checksum,
          contentType: blob.type,
          bytes: blob.size,
        });
        if (!ticket.ok) throw new Error(ticket.message);

        const sent = await fetch(ticket.url, {
          method: ticket.method,
          headers: ticket.headers,
          body: blob,
        });
        if (!sent.ok) throw new Error(`that didn't save (${sent.status})`);

        await registerVoiceMemory({
          subjectId,
          storagePath: ticket.storagePath,
          checksum,
          mimeType: ticket.contentType,
          durationSeconds: seconds,
          transcript: String(formData.get("transcript") ?? "").trim(),
          memoryDate: String(formData.get("memory_date") ?? "") || null,
        });

        setPhase("saved");
        blobRef.current = null;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "That didn't save. Try once more.");
        setPhase("review");
      }
    },
    [previewUrl, seconds, subjectId]
  );

  const mmss = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  // Nothing to say while it is working, or before anything has happened.
  const said = mic === "unasked" || mic === "ready" ? null : SAYS[mic];

  return (
    <div className="card">
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {phase === "idle" && (
        <div>
          <p className="text-sm">
            Their voice now &mdash; a word they say oddly, a song, a whole
            conversation.
          </p>

          {/* Where we stand, and what to do about it. Only ever one of these
              at a time, and none of them is a dead end. */}
          {said ? (
            <div className="mt-3 rounded-xl bg-paper p-4">
              <p className="max-w-[46ch] text-sm leading-relaxed">{said.what}</p>
              {said.next && (
                <p className="mt-1.5 max-w-[46ch] text-sm leading-relaxed text-stone">
                  {said.next}
                </p>
              )}
            </div>
          ) : (
            // The reason, above the browser's dialog rather than after it.
            // The dialog has room for a hostname; everything a parent needs
            // in order to say yes has to already have been read.
            mic !== "ready" && (
              <p className="mt-3 max-w-[48ch] text-xs leading-relaxed text-stone">
                {BEFORE_ASKING}
              </p>
            )
          )}

          {(!said || said.retryable) && (
            <button onClick={start} className="btn mt-4">
              {asks > 0 ? "Try the microphone again" : "Start recording"}
            </button>
          )}

          {/* Refusing must cost nothing else. Saying so is the difference
              between a request and a toll gate, and it is true — the quote
              box above this one takes the same memory in words. */}
          {said && !said.retryable && (
            <p className="mt-4 max-w-[48ch] text-xs leading-relaxed text-stone">
              Everything else on this page still works. If you write down what
              they said instead, it goes in the book exactly the same way
              &mdash; only the sound of it is missing.
            </p>
          )}
        </div>
      )}

      {phase === "recording" && (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 font-display text-3xl tabular-nums">
            <span className="h-3 w-3 animate-pulse rounded-full bg-clay" aria-hidden="true" />
            {mmss}
          </div>
          <button onClick={stop} className="btn mt-4">Stop</button>
        </div>
      )}

      {(phase === "review" || phase === "saving") && (
        <form action={save} className="space-y-3">
          {previewUrl && <audio controls src={previewUrl} className="w-full" />}
          <div>
            <label className="label" htmlFor="transcript">What they said</label>
            <input
              className="input"
              id="transcript"
              name="transcript"
              placeholder="Moon gone to work."
              required
            />
            <p className="mt-1 text-xs text-stone">
              This is what gets printed. The recording is what gets heard.
            </p>
          </div>
          <input className="input" type="date" name="memory_date" />
          <div className="flex gap-2">
            <button className="btn" disabled={phase === "saving"}>
              {phase === "saving" ? "Keeping…" : "Keep this"}
            </button>
            <button type="button" onClick={discard} className="btn-secondary">
              Record again
            </button>
          </div>
        </form>
      )}

      {phase === "saved" && (
        <div className="text-center">
          <p className="font-display text-lg">Kept.</p>
          <p className="mt-1 text-sm text-stone">
            If this one makes the book, the printed page will carry a small code —
            scan it and you&rsquo;ll hear this again.
          </p>
          <button onClick={() => setPhase("idle")} className="btn-secondary mt-4">
            Record another
          </button>
        </div>
      )}
    </div>
  );
}
