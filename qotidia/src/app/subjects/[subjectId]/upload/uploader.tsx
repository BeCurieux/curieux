"use client";

// Bulk photo uploader (brief §7).
// Per file: checksum → duplicate check → private storage upload → register
// memory + asset → analysis queued server-side. Progressive per-file state;
// the page never blocks on processing.

import { useCallback, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/client";
import { registerUploadedPhoto } from "@/app/actions";

type FileState = "hashing" | "uploading" | "checking" | "done" | "duplicate" | "refused" | "error";

interface Item {
  name: string;
  state: FileState;
  error?: string;
  /** Set once the server has a row for it, so its verdict can be followed. */
  assetId?: string;
}

/** How long to keep asking before saying "still being checked" and stopping. */
const CHECK_FOR_MS = 20_000;
const CHECK_EVERY_MS = 2_000;

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function imageDimensions(file: File): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => resolve({ width: null, height: null });
    img.src = url;
  });
}

export function Uploader({ subjectId }: { subjectId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  // The poll loop needs the live list, and closing over `items` would freeze
  // it at whatever it was when the loop started.
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setItem = (name: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, ...patch } : i)));

  /**
   * Follow the files through the check the server does after the upload.
   *
   * Polling rather than pushing, because the alternative is a socket held
   * open for something that resolves in seconds. It gives up after a while
   * and says so — a spinner that never stops is a worse answer than "still
   * being checked", and in a dev environment with no job runner that is
   * exactly what would happen.
   */
  const followVerdicts = useCallback(async () => {
    const until = Date.now() + CHECK_FOR_MS;
    for (;;) {
      const pending = itemsRef.current.filter((i) => i.state === "checking" && i.assetId);
      if (pending.length === 0) return;
      if (Date.now() > until) return;

      await new Promise((r) => setTimeout(r, CHECK_EVERY_MS));
      const ids = pending.map((i) => i.assetId!).join(",");
      let verdicts: Record<string, { verdict: string; reason: string | null }> = {};
      try {
        const res = await fetch(`/api/media/verdicts?assets=${encodeURIComponent(ids)}`);
        if (!res.ok) return;
        verdicts = (await res.json()).verdicts ?? {};
      } catch {
        return; // offline, or the tab is going away. Not worth a red cross.
      }

      setItems((prev) =>
        prev.map((i) => {
          const v = i.assetId ? verdicts[i.assetId] : undefined;
          if (!v || i.state !== "checking") return i;
          if (v.verdict === "clean") return { ...i, state: "done" as FileState };
          if (v.verdict === "quarantined" || v.verdict === "failed") {
            return { ...i, state: "refused" as FileState, error: v.reason ?? "We could not keep that one." };
          }
          return i;
        })
      );
    }
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const images = [...files].filter((f) => f.type.startsWith("image/"));
      setItems((prev) => [...prev, ...images.map((f) => ({ name: f.name, state: "hashing" as FileState }))]);

      const supabase = browserClient();
      const { data: auth } = await supabase.auth.getUser();

      // Small concurrency pool so 150 files don't fire at once.
      const queue = [...images];
      const workers = Array.from({ length: 4 }, async () => {
        for (;;) {
          const file = queue.shift();
          if (!file) return;
          try {
            const buf = await file.arrayBuffer();
            const checksum = await sha256Hex(buf);
            const { width, height } = await imageDimensions(file);
            setItem(file.name, { state: "uploading" });

            const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
            const path = `${auth.user?.id}/${subjectId}/${checksum}.${ext}`;
            const { error: upErr } = await supabase.storage
              .from("media")
              .upload(path, file, { contentType: file.type, upsert: true });
            if (upErr && !upErr.message.includes("already exists")) throw upErr;

            const result = await registerUploadedPhoto({
              subjectId,
              storagePath: path,
              checksum,
              mimeType: file.type,
              width,
              height,
              captureTimestamp: file.lastModified ? new Date(file.lastModified).toISOString() : null,
              memoryDate: file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : null,
            });
            // Not "done" yet. The file is in storage but the server has not
            // read it — and until it has, it will not be shown anywhere.
            // Saying "added" here would be claiming something we do not know.
            setItem(file.name, {
              state: result.duplicate ? "duplicate" : "checking",
              assetId: result.duplicate ? undefined : result.assetId,
            });
          } catch (err) {
            setItem(file.name, { state: "error", error: err instanceof Error ? err.message : "upload failed" });
          }
        }
      });
      await Promise.all(workers);
      void followVerdicts();
    },
    [subjectId, followVerdicts]
  );

  const doneCount = items.filter((i) => i.state === "done").length;
  const refusedCount = items.filter((i) => i.state === "refused").length;
  const dupeCount = items.filter((i) => i.state === "duplicate").length;
  const busyCount = items.filter((i) => i.state === "hashing" || i.state === "uploading").length;
  const checkingCount = items.filter((i) => i.state === "checking").length;

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition ${
          dragOver ? "border-clay bg-rule/40" : "border-rule bg-white"
        }`}
      >
        <p className="font-display text-lg">Drop photos here</p>
        <p className="mt-1 text-sm text-stone">or tap to choose from your device</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && void handleFiles(e.target.files)}
        />
      </div>

      {items.length > 0 && (
        <div className="mt-4 text-sm">
          <p className="text-ink/70">
            {doneCount} added{dupeCount > 0 && `, ${dupeCount} already there`}
            {busyCount > 0 && `, ${busyCount} in progress…`}
            {checkingCount > 0 && `, ${checkingCount} being checked`}
            {refusedCount > 0 && `, ${refusedCount} not kept`}
          </p>
          {refusedCount > 0 && (
            <p className="mt-1 max-w-[50ch] text-xs leading-relaxed text-stone">
              We read every file before it is stored, and one of these
              wasn&rsquo;t what it said it was. Nothing else was affected.
            </p>
          )}
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-stone">
            {items.map((i, idx) => (
              <li key={`${i.name}-${idx}`}>
                {i.state === "done" && "✓"}
                {i.state === "duplicate" && "≡"}
                {(i.state === "error" || i.state === "refused") && "✕"}
                {(i.state === "hashing" || i.state === "uploading" || i.state === "checking") && "…"}{" "}
                {i.name}
                {i.error && <span className="text-red-600"> — {i.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
