import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalculatorForm } from "@/components/calc/calculator-form";
import { calculator } from "@/lib/calc";
import { toFormValues } from "@/lib/calc/form-values";
import { latestRun, myCurrency } from "@/lib/calc/runs";
import { defaultInputs } from "@/lib/calc/types";
import { requireUser } from "@/lib/auth/session";
import { UNLOCKED_BY } from "@/lib/course/tiers";
import { userClient } from "@/lib/supabase/server";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  return { title: calculator((await params).slug)?.name ?? "Tool" };
}

// One calculator. Gated on the server by its tier; shows her last run, or
// fills what it can from her other runs (true cost from Landed Cost, …).
export default async function ToolPage({ params }: { params: Params }) {
  const { slug } = await params;
  const calc = calculator(slug);
  if (!calc) notFound();
  if (calc.slug === "product-verdict") redirect("/verdict");
  await requireUser(`/tools/${slug}`);
  const supabase = await userClient();

  const { data: allowed, error } = await supabase.rpc("can_access", { p_min: calc.minTier });
  if (error) throw new Error(`can_access: ${error.message}`);

  const header = (
    <>
      <p className="text-mute">
        <Link href="/tools">Tools</Link>
      </p>
      <h1 className="mt-3 text-4xl">{calc.name}</h1>
      <p className="mt-3 text-lg">{calc.description}</p>
    </>
  );

  if (!allowed) {
    return (
      <main id="main" className="mx-auto w-full max-w-2xl px-5 py-10">
        {header}
        <div className="border-line bg-paper mt-8 rounded-2xl border p-6" data-testid="tool-locked">
          <h2 className="text-2xl">This tool is locked</h2>
          <p className="mt-3">It opens with {UNLOCKED_BY[calc.minTier]}.</p>
          <p className="mt-4">
            <Link href="/pricing">See what's included</Link>
          </p>
        </div>
      </main>
    );
  }

  const [run, currency] = await Promise.all([latestRun(supabase, slug), myCurrency(supabase)]);
  let inputs = run?.inputs_json ?? defaultInputs(calc.fields);
  if (!run && calc.prefill) {
    for (const [field, source] of Object.entries(calc.prefill)) {
      const from = await latestRun(supabase, source.from);
      const value = from?.outputs_json[source.output];
      if (typeof value === "number" && Number.isFinite(value))
        inputs = { ...inputs, [field]: Math.round(value * 100) / 100 };
    }
  }

  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10">
      {header}
      <div className="mt-8">
        <CalculatorForm
          slug={slug}
          initial={toFormValues(calc.fields, inputs)}
          lastSavedAt={run?.created_at ?? null}
          currency={currency}
        />
      </div>
    </main>
  );
}
