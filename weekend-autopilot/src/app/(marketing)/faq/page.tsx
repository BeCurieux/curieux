import type { Metadata } from "next";
import { SectionLabel } from "@/components/ui";
import { FAQ_ITEMS } from "../page";

export const metadata: Metadata = { title: "Questions" };

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16 sm:py-24">
      <SectionLabel>Questions</SectionLabel>
      <h1 className="mt-3 text-[36px] leading-[1.1] text-ink sm:text-[46px]">
        Everything people ask.
      </h1>

      <dl className="mt-12 divide-y divide-rule border-y border-rule">
        {FAQ_ITEMS.map((faq) => (
          <div key={faq.q} className="py-6">
            <dt className="text-[19px] leading-snug text-ink">{faq.q}</dt>
            <dd className="mt-2 max-w-prose text-[16px] leading-relaxed text-graphite">{faq.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
