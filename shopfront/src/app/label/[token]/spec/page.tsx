/**
 * The spec, for labellers. Every definition and rule, from the same source
 * the classifier is prompted with, so labellers and model work from one text.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { dimension, GLOBAL_BOUNDARY_RULES, MODEL_DIMENSIONS, TAXONOMY_VERSION } from "@/lib/genome/v1/taxonomy";
import { labellerFor, PRIVATE_PAGE } from "../access";
import "../../label.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "The spec — popuup labelling", ...PRIVATE_PAGE };

export default async function SpecPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await labellerFor(token);

  return (
    <main className="lab">
      <header className="lab-head">
        <p className="lab-who">{TAXONOMY_VERSION}</p>
        <nav className="lab-nav">
          <Link href={`/label/${token}`}>Back to labelling</Link>
        </nav>
      </header>

      <section className="lab-card lab-spec">
        <h1>How to label</h1>
        <p>
          You will see one product at a time: its photographs, title and description as the merchant published them.
          For each dimension, choose what the listing supports. Work from these definitions, not from what you think
          the shop is trying to say.
        </p>
        <p>
          <strong>Unknown is always a correct answer</strong> when the listing does not support anything else, or the
          evidence is genuinely split. A confident guess is worse than an honest unknown.
        </p>
        <h2>Rules for every dimension</h2>
        <ul>
          {GLOBAL_BOUNDARY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      {MODEL_DIMENSIONS.map((id) => {
        const d = dimension(id);
        return (
          <section key={id} className="lab-card lab-spec">
            <h2>{d.label}</h2>
            <p className="lab-question">
              {d.question}{" "}
              <span className="lab-rule">
                {d.cardinality === "single" ? "One answer." : d.maxLabels ? `Up to ${d.maxLabels}.` : "All that apply."}
              </span>
            </p>
            <dl className="lab-defs">
              {d.values.map((v) => (
                <div key={v.id}>
                  <dt>{v.label}</dt>
                  <dd>{v.definition}</dd>
                </div>
              ))}
            </dl>
            {d.boundaryRules.map((rule) => (
              <p key={rule} className="lab-boundary">
                {rule}
              </p>
            ))}
          </section>
        );
      })}
    </main>
  );
}
