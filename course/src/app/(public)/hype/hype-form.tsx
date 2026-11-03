"use client";

import { useActionState, useState } from "react";
import { LeadForm } from "@/components/site/lead-form";
import { joinFree } from "../lead-actions";
import { runHypeCheck, type HypeState } from "./actions";

export function HypeForm({ utmSource }: { utmSource?: string }) {
  const [state, action, pending] = useActionState<HypeState, FormData>(runHypeCheck, {
    status: "idle",
  });
  const [copied, setCopied] = useState(false);

  const share =
    state.status === "done"
      ? `My post scored ${state.result.score}/100 on the Hype Check (${state.result.band.toLowerCase()}). It leaves out: ${state.result.leavesOut
          .map((l) => l.replace(/\.$/, "").toLowerCase())
          .join("; ")}. Check yours: ${window.location.origin}/hype`
      : "";

  return (
    <>
      <form action={action} className="space-y-4">
        <label htmlFor="post" className="block font-semibold">
          The post
        </label>
        <textarea
          id="post"
          name="post"
          rows={8}
          required
          maxLength={5000}
          className="border-line bg-paper block w-full rounded-xl border px-4 py-3 text-lg"
        />
        {state.status === "error" ? (
          <p role="alert" className="text-danger">
            {state.message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="bg-accent text-on-accent w-full rounded-full px-6 py-4 text-lg font-semibold disabled:opacity-60"
        >
          {pending ? "Checking…" : "Check it"}
        </button>
      </form>

      {state.status === "done" ? (
        <section
          className="border-line bg-paper mt-8 rounded-2xl border p-6"
          aria-live="polite"
          data-testid="hype-result"
        >
          <h2 className="text-2xl">
            <span className="text-5xl" data-testid="hype-score">
              {state.result.score}
            </span>
            <span className="text-mute">/100</span> · {state.result.band}
          </h2>
          {state.result.signals.length ? (
            <>
              <h3 className="mt-5 text-xl">What it leans on</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {state.result.signals.map((s) => (
                  <li key={s.id}>
                    {s.label}: <q>{s.matches.slice(0, 2).join("”, “")}</q>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {state.result.leavesOut.length ? (
            <>
              <h3 className="mt-5 text-xl">What it leaves out</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5" data-testid="leaves-out">
                {state.result.leavesOut.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </>
          ) : null}
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(share);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
            className="border-accent text-accent mt-6 rounded-full border px-5 py-3 font-semibold"
          >
            {copied ? "Copied" : "Copy to share"}
          </button>

          <div className="border-line mt-8 border-t pt-6">
            <h3 className="text-xl">Checking your own product idea?</h3>
            <p className="mt-2">
              Optional: get the free Product Check, two lessons and two calculators.
            </p>
            <div className="mt-4">
              <LeadForm
                action={joinFree.bind(null, "hype_check")}
                button="Send me the free check"
                utmSource={utmSource}
                sentText="We've sent you a link to the free lessons and calculators."
              />
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
