"use client";

// Publishing and sharing (brief §21, §27).
//
// Two things happen in this panel. The first time someone presses Publish we
// ask who they are — and only then, which is the whole of §27. After that it
// hands over the three ways to use the widget: a link, an iframe, and the
// script tag that resizes itself.

import { useState } from "react";
import Link from "next/link";
import { CheckIcon, CloseIcon, CodeIcon, CopyIcon, LinkIcon } from "@/components/ui/Icons";
import { brand } from "@/config/brand";
import { signUpAction } from "@/app/actions";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-panel border border-rule bg-white shadow-pop">
        <div className="flex items-center justify-between border-b border-rule px-5 py-4">
          <h2 className="text-base font-bold">{title}</h2>
          <button type="button" className="btn-ghost px-2" onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function SignupPanel({
  onDone,
  onClose,
}: {
  onDone: () => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Modal title="Almost there" onClose={onClose}>
      <p className="text-sm leading-relaxed text-slate">
        Create an account and your widget goes live. Everything you&rsquo;ve built so far comes with
        you — nothing is lost.
      </p>

      <form
        className="mt-5 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError(null);
          const result = await signUpAction(new FormData(event.currentTarget));
          setBusy(false);
          if (result.ok) onDone();
          else setError(result.error ?? "That didn't work.");
        }}
      >
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" autoComplete="email" required className="input" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="input"
          />
          <span className="mt-1 block text-xs text-muted">At least 8 characters.</span>
        </label>

        {error ? (
          <p className="text-sm font-medium text-coral" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="btn w-full" disabled={busy}>
          {busy ? "Creating your account…" : "Create account & publish"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-purple">
          Sign in
        </Link>
      </p>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

export function SharePanel({
  slug,
  origin,
  onClose,
}: {
  slug: string;
  origin: string;
  onClose: () => void;
}) {
  const hosted = `${origin}/w/${slug}`;
  const iframe = `<iframe src="${origin}/embed/${slug}" style="width:100%;border:0;height:560px" title="${slug}" loading="lazy"></iframe>`;
  const script = `<script src="${origin}/embed.js" async></script>\n<div data-widget="${slug}"></div>`;

  return (
    <Modal title="It's live" onClose={onClose}>
      <p className="flex items-center gap-2 text-sm font-semibold text-navy">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-mint text-white">
          <CheckIcon size={13} strokeWidth={3} />
        </span>
        Your widget is published.
      </p>

      <div className="mt-5 space-y-5">
        <Snippet
          icon={<LinkIcon size={16} />}
          title="Share a link"
          hint="A hosted page, good enough to use on its own."
          value={hosted}
          href={hosted}
        />
        <Snippet
          icon={<CodeIcon size={16} />}
          title="Add it to your site"
          hint="One line. The widget tells the page how tall to be as people answer."
          value={script}
          multiline
        />
        <Snippet
          icon={<CodeIcon size={16} />}
          title="Or a plain iframe"
          hint="For site builders that won't let you add a script."
          value={iframe}
          multiline
        />
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        Changes you make from now on stay in draft until you press Publish again — the live version
        won&rsquo;t change under your visitors&rsquo; feet.
      </p>
    </Modal>
  );
}

function Snippet({
  icon,
  title,
  hint,
  value,
  href,
  multiline,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  value: string;
  href?: string;
  multiline?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <p className="flex items-center gap-2 text-sm font-bold">
        <span className="text-purple">{icon}</span>
        {title}
      </p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>

      <div className="mt-2 flex items-start gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-btn border border-rule bg-lavender px-3 py-2.5 font-mono text-[11px] leading-relaxed text-navy">
          {value}
        </code>
        <button
          type="button"
          className="btn-secondary flex-none px-3 py-2.5"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              // Clipboard blocked — the text is right there to select.
            }
          }}
        >
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          <span className="sr-only">Copy {title}</span>
        </button>
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block text-xs font-semibold text-purple hover:underline"
        >
          Open it →
        </a>
      ) : null}
      {multiline ? null : null}
    </div>
  );
}

export function badgeExplainer(): string {
  return `Free widgets carry a small “${brand.badgeLabel} ${brand.name}” badge.`;
}
