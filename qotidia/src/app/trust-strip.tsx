// Six things, under the drop zone.
//
// Quiet on purpose. A parent about to upload four hundred photographs of
// their child needs the answer to be *available*, not shouted — a loud
// reassurance block at that exact moment reads as a company that knows it is
// asking for something.
//
// So: small type, no icons, no padlocks, no shields. Every line is a link to
// the place the thing is actually done. lib/trust/claims.ts argues why.

import Link from "next/link";
import { AT_UPLOAD, CHECKABLE } from "@/lib/trust/claims";

export function TrustStrip({ className = "" }: { className?: string }) {
  return (
    <div className={`border-t border-rule pt-5 ${className}`}>
      <ul className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2 md:grid-cols-3">
        {AT_UPLOAD.map((c) => (
          <li key={c.id} className="group">
            <Link href={c.href} title={c.proof} className="block">
              {/* The title carries the link colour rather than waiting for a
                  hover. The sentence at the bottom says every one of these
                  goes somewhere; six headings in plain ink make that sentence
                  false in the only way a reader can perceive — and a claim
                  about checkability that does not look checkable is the
                  precise failure this whole strip exists to avoid. */}
              <span className="text-sm text-ochre underline decoration-ochre/30 underline-offset-4 group-hover:decoration-ochre">
                {c.title}
              </span>
              <span className="mt-1 block max-w-[34ch] text-xs leading-relaxed text-stone">
                {c.blurb}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-5 max-w-[52ch] text-xs leading-relaxed text-stone">{CHECKABLE}</p>
    </div>
  );
}
