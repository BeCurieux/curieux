import Link from "next/link";
import type { Metadata } from "next";
import { PromptBox } from "@/components/create/PromptBox";
import { StartFromScratch } from "@/components/create/StartFromScratch";
import { Illustration } from "@/components/illustrations/Illustration";
import { ArrowRightIcon } from "@/components/ui/Icons";
import { TEMPLATES } from "@/lib/templates/catalogue";

export const metadata: Metadata = { title: "New widget" };

/** The New widget screen (brief §29). */
export default function NewWidgetPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-title text-center">What do you want to build?</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-slate">
        Describe it in a sentence or two. Mention the questions you want to ask and what things
        cost, and we&rsquo;ll wire up the maths.
      </p>

      <div className="mt-8">
        <PromptBox variant="page" autoFocus />
      </div>

      <div className="my-10 flex items-center gap-4">
        <span className="h-px flex-1 bg-rule" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">
          or start with a template
        </span>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {TEMPLATES.slice(0, 3).map((template) => (
          <Link
            key={template.slug}
            href={`/templates/${template.slug}`}
            className="card p-4 transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            <Illustration name={template.illustration} size={40} />
            <p className="mt-3 text-sm font-bold leading-tight">{template.name}</p>
            <p className="mt-1 text-xs capitalize text-muted">{template.type}</p>
          </Link>
        ))}
      </div>

      <p className="mt-4 text-center">
        <Link href="/templates" className="text-sm font-semibold text-purple hover:underline">
          All templates <ArrowRightIcon size={14} className="inline" />
        </Link>
      </p>

      <div className="mt-10">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted">
          or from scratch
        </p>
        <StartFromScratch />
      </div>
    </div>
  );
}
