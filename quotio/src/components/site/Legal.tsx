import Link from "next/link";
import { brand, legalEntityKnown } from "@/config/brand";

/**
 * Shared furniture for the terms and privacy pages.
 *
 * The draft notice is the point of this file. A privacy policy that names no
 * operator is not a policy, and one that says "[COMPANY NAME]" is worse than
 * none — so if config/brand.ts hasn't been filled in, the page says so at the
 * top rather than reading as finished (§41).
 */

export function LegalNotice() {
  if (legalEntityKnown()) return null;
  return (
    <div className="mt-6 rounded-card border border-yellow/50 bg-yellow-soft p-4">
      <p className="text-sm font-bold">This page isn&rsquo;t finished.</p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate">
        It doesn&rsquo;t yet name the company operating {brand.name}, its address, or the law it
        answers to — so it isn&rsquo;t something you can rely on, and we can&rsquo;t take payment
        behind it. Fill in <code className="font-mono text-xs">brand.legal</code> in the code, and
        have a lawyer read the result.
      </p>
    </div>
  );
}

export function Operator() {
  if (!legalEntityKnown()) return <>the company operating {brand.name}</>;
  return <>{brand.legal.entity}</>;
}

export function LegalUpdated({ date }: { date: string }) {
  return <p className="mt-3 text-sm text-muted">Last updated {date}.</p>;
}

export function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-slate">{children}</div>
    </section>
  );
}

export function LegalFooterLinks({ current }: { current: "terms" | "privacy" }) {
  return (
    <p className="mt-12 border-t border-rule pt-6 text-sm text-muted">
      {current === "terms" ? (
        <>
          See also our{" "}
          <Link href="/privacy" className="font-semibold text-purple">
            privacy policy
          </Link>
          .
        </>
      ) : (
        <>
          See also our{" "}
          <Link href="/terms" className="font-semibold text-purple">
            terms
          </Link>
          .
        </>
      )}{" "}
      Questions about either:{" "}
      <a href={`mailto:${brand.supportEmail}`} className="font-semibold text-purple">
        {brand.supportEmail}
      </a>
      .
    </p>
  );
}
