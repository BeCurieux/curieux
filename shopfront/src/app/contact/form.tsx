"use client";

/**
 * The one form on the site.
 *
 * **Sprint 3 email capture, opened on the owner's explicit call
 * (2026-08-17).** See `CLAUDE.md` and `lib/earlyaccess/types.ts`. What opened
 * is popuup asking a merchant for their own address. What stays shut is a
 * generated shop asking a *shopper* for theirs — the `capture` block still
 * renders nothing and is still absent from what the merchandiser may choose.
 *
 * Three rules shaped this, all of them about the failure cases rather than the
 * happy one, because the happy path of a contact form is not where forms lie.
 *
 * **1. It never says "thanks" unless a row exists.** The submit awaits the
 * response and reads the status. A 503 says the write failed and shows the
 * address to email instead. This is the whole reason the form was worth
 * building rather than faking — a form that renders success on `catch` is
 * worse than the mailto link it replaced, because the mailto at least visibly
 * did nothing.
 *
 * **2. It works before JavaScript decides to.** The action is a real POST to
 * a real endpoint and the fields are real inputs, so a submit that beats
 * hydration lands somewhere rather than nowhere. `onSubmit` calls
 * `preventDefault` only once it is running.
 *
 * **3. Errors are attached to fields, not stacked above them.** The server
 * returns the first bad field and this puts the message beside it, marks it
 * `aria-invalid`, and moves focus there. A summary at the top of a four-field
 * form makes a person hunt for what they got wrong.
 *
 * No captcha and no honeypot. A honeypot is a hidden field that punishes
 * screen-reader users for filling in a field their software told them about,
 * and a captcha needs a third-party service, which is a question for the owner
 * rather than a thing to add quietly. The table is service-role only, so spam
 * costs junk in an inbox a human reads.
 */

import { useEffect, useRef, useState } from "react";
import { LIMITS } from "@/lib/earlyaccess/types";
import { INBOX } from "@/lib/origin";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent" }
  | { kind: "error"; message: string; field: string | null };

const FIELDS = [
  { name: "name", label: "Your name", type: "text", placeholder: "", max: LIMITS.name },
  { name: "email", label: "Email", type: "email", placeholder: "you@yourbrand.com", max: LIMITS.email },
  { name: "store", label: "Your store", type: "text", placeholder: "yourbrand.com", max: LIMITS.store },
] as const;

export function EarlyAccessForm() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const form = useRef<HTMLFormElement>(null);
  const badField = state.kind === "error" ? state.field : null;

  /*
   * Move focus to the field the server objected to.
   *
   * In an effect rather than inline after `setState`, because inline did not
   * work and looked as though it did. While the request is in flight every
   * input carries `disabled`, and a disabled element cannot take focus — so
   * calling `.focus()` in the same tick as the state change was a no-op, and
   * the person was left with a message beside an input they had to find
   * themselves. Measured, not spotted: `document.activeElement` was `body`.
   *
   * By the time an effect runs, React has re-rendered with `disabled` gone.
   */
  useEffect(() => {
    if (!badField) return;
    const field = form.current?.elements.namedItem(badField);
    if (field instanceof HTMLElement) field.focus();
  }, [badField]);

  if (state.kind === "sent") {
    return (
      <div className="form-done" role="status">
        <p className="form-done-lead">Got it.</p>
        <p>
          We read these by hand, so a reply takes as long as it takes — usually a day or two. If your storefront is
          public we will have built something to look at by then.
        </p>
        <p className="form-done-note">
          Nothing is charged, and there is nothing to cancel. If you would rather chase it up directly,{" "}
          <a href={`mailto:${INBOX}`}>{INBOX}</a>.
        </p>
      </div>
    );
  }

  const sending = state.kind === "sending";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ kind: "sending" });

    const data = new FormData(event.currentTarget);
    const body = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      store: String(data.get("store") ?? ""),
      brief: String(data.get("brief") ?? ""),
    };

    let response: Response;
    try {
      response = await fetch("/api/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Offline, or the request never left. Not a success, and not a mystery
      // either — the person can see they have no connection.
      setState({
        kind: "error",
        message: `That did not send. Check your connection, or email ${INBOX}.`,
        field: null,
      });
      return;
    }

    if (response.status === 201) {
      setState({ kind: "sent" });
      return;
    }

    const problem = (await response.json().catch(() => null)) as
      | { error?: string; field?: string | null }
      | null;

    // Focus moves to the field in the effect above, not here — see the note
    // on it. Doing it inline runs while the input is still disabled.
    setState({
      kind: "error",
      message: problem?.error ?? `Something went wrong at our end. Email ${INBOX} and we will pick it up there.`,
      field: problem?.field ?? null,
    });
  }

  return (
    <form ref={form} className="ask" action="/api/early-access" method="post" onSubmit={submit} noValidate>
      {FIELDS.map((field) => (
        <label key={field.name} className="ask-field">
          <span className="ask-label">{field.label}</span>
          <input
            name={field.name}
            type={field.type}
            placeholder={field.placeholder}
            maxLength={field.max}
            required
            disabled={sending}
            aria-invalid={badField === field.name || undefined}
            aria-describedby={badField === field.name ? "ask-problem" : undefined}
          />
          {badField === field.name && (
            <span className="ask-problem" id="ask-problem">
              {state.kind === "error" ? state.message : ""}
            </span>
          )}
        </label>
      ))}

      <label className="ask-field">
        <span className="ask-label">
          Who is the shop for? <span className="ask-optional">optional</span>
        </span>
        <textarea
          name="brief"
          rows={5}
          maxLength={LIMITS.brief}
          disabled={sending}
          placeholder="People arriving from our linen reel. Nothing over £150, in stock only."
        />
      </label>

      <button className="btn btn-lg" type="submit" disabled={sending}>
        {sending ? "Sending…" : "Send it"} <span aria-hidden="true">→</span>
      </button>

      {/*
        The failure that is not about a field: a write that did not happen, or
        a request that never left. Live, so a screen reader hears it without
        the focus move that a field error gets.
      */}
      {state.kind === "error" && !badField && (
        <p className="ask-problem ask-problem-wide" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
