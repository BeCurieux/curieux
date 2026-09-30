import { ArrowRight, Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ImportForm } from "@/components/business/import-form";
import { BackLink } from "@/components/demo/back-link";
import { requireOwner } from "@/lib/business/owner";
import { listImports } from "@/lib/domain/imports";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Move your school in" };

const TEMPLATES = [
  { href: "/templates/ovyko-classes.csv", label: "Classes template" },
  { href: "/templates/ovyko-students.csv", label: "Students template" },
];

function count(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function ImportPage() {
  const { db } = await requireOwner();
  const past = await listImports(db);
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href="/business/settings">Settings</BackLink>
      <div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Move your school in</h1>
        <p className="mt-2 text-muted">
          Export your classes and students from your current system as CSV files. We&apos;ll show
          you exactly what will come across before anything is saved, and you can run it again later
          to pick up new families.
        </p>
      </div>

      <ol className="flex list-inside list-decimal flex-col gap-2 rounded-lg border border-line bg-surface p-5">
        <li>
          Set up your{" "}
          <Link href="/business/settings/locations" className="font-semibold underline">
            locations
          </Link>{" "}
          and{" "}
          <Link href="/business/settings/programs" className="font-semibold underline">
            levels
          </Link>{" "}
          first. Files are matched to them by name.
        </li>
        <li>
          Use your system&apos;s export, or start from a template:
          <span className="mt-2 flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <a
                key={t.href}
                href={t.href}
                download
                className="inline-flex h-10 items-center gap-2 rounded-full bg-surface-soft px-4 text-sm font-semibold [&_svg]:size-4"
              >
                <Download aria-hidden />
                {t.label}
              </a>
            ))}
          </span>
        </li>
        <li>Upload them below and check what will happen.</li>
      </ol>

      <ImportForm />

      {past.length ? (
        <section aria-labelledby="past-imports" className="flex flex-col gap-3">
          <h2 id="past-imports" className="font-display text-xl font-semibold">
            Past imports
          </h2>
          <ul className="flex flex-col gap-2">
            {past.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/business/settings/import/${b.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4 transition hover:border-ink"
                >
                  <span>
                    <span className="block font-semibold">{formatDateTime(b.createdAt)}</span>
                    <span className="text-sm text-muted">
                      {b.undoneAt
                        ? "Undone"
                        : `${count(b.added.children, "child", "children")} and ${count(b.added.classes, "class", "classes")} added`}
                    </span>
                  </span>
                  <ArrowRight aria-hidden className="size-5 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
