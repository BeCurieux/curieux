// One tool.
//
// The promise sits above the tool rather than below it: somebody deciding
// whether to hand a page four hundred photographs of their child needs the
// sentence before they decide, not after.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { BASE } from "@/app/robots";
import { NEVER, publishedTools, toolBySlug } from "@/lib/tools/list";

export const dynamicParams = false;

export function generateStaticParams() {
  return publishedTools().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const params = await props.params;
  const tool = toolBySlug(params.slug);
  if (!tool) return { title: BRAND };
  return {
    title: `${tool.title} — ${BRAND}`,
    description: tool.description,
    alternates: { canonical: `${BASE}/tools/${tool.slug}` },
  };
}

export default async function ToolPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const tool = toolBySlug(params.slug);
  if (!tool) notFound();

  const Tool = tool.tool;

  return (
    <div className="mx-auto !max-w-2xl py-16">
      <p className="text-sm text-clay">{tool.question}</p>
      <h1
        className="mt-3 max-w-[18ch] font-display leading-[1.05]"
        style={{ fontSize: "clamp(2rem, 5.5vw, 3rem)" }}
      >
        {tool.title}
      </h1>
      {/* Before the tool, deliberately. Somebody deciding whether to hand a
          page four hundred photographs of their child needs this first. */}
      <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-stone">{tool.promise}</p>

      <div className="mt-10">
        <Tool />
      </div>

      <section className="mt-20 border-t border-rule pt-10">
        <h2 className="font-display text-xl">What this never does</h2>
        <ul className="mt-4 space-y-2 text-sm text-stone">
          {NEVER.map((x) => (
            <li key={x} className="flex gap-2.5">
              <span className="text-clay">&mdash;</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-12 text-sm text-stone">
        <Link href="/tools" className="text-ochre">Other tools</Link>
        {" · "}
        <Link href="/journal" className="text-ochre">The journal</Link>
      </footer>
    </div>
  );
}
