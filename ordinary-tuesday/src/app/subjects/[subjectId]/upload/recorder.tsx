"use client";

// Voice memories (brief §6, §7).
// Records in the browser, uploads to the same private bucket as photographs,
// and stores the parent's own transcription alongside it. The transcript is
// what gets printed; the recording is what gets heard.

import { useCallback, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/client";
import { registerVoiceMemory } from "@/app/actions";

type Phase = "idle" | "recording" | "review" | "saving" | "saved";

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function Recorder({ subjectId }: { subjectId: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = useCallback(async () => {
    setError(null);
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
    } catch {
      setError("We couldn't reach your microphone. Check the browser's permission and try again.");
    }
  }, []);

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
        const supabase = browserClient();
        const { data: auth } = await supabase.auth.getUser();
        const buf = await blob.arrayBuffer();
        const checksum = await sha256Hex(buf);
        const ext = blob.type.includes("mp4") ? "m4a" : "webm";
        const path = `${auth.user?.id}/${subjectId}/${checksum}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, blob, { contentType: blob.type, upsert: true });
        if (upErr && !upErr.message.includes("already exists")) throw upErr;

        await registerVoiceMemory({
          subjectId,
          storagePath: path,
          checksum,
          mimeType: blob.type,
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

  return (
    <div className="card">
      {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {phase === "idle" && (
        <div className="text-center">
          <p className="text-sm text-stone">
            Their voice now — a word they say oddly, a song, a whole conversation.
          </p>
          <button onClick={start} className="btn mt-4">Start recording</button>
        </div>
      )}

      {phase === "recording" && (
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 font-display text-3xl tabular-nums">
            <span className="h-3 w-3 animate-pulse rounded-full bg-boot" aria-hidden="true" />
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
