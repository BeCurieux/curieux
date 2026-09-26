/**
 * Every product in the gold set, and whether this labeller has finished it.
 * The way back to an answer somebody wants to change.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { completedItems } from "@/lib/genome/v1/gold";
import { TAXONOMY_VERSION } from "@/lib/genome/v1/taxonomy";
import { labellerFor, PRIVATE_PAGE } from "../access";
import "../../label.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "All products — popuup labelling", ...PRIVATE_PAGE };

export default async function ItemsPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { store, labeller } = await labellerFor(token);
  const items = await store.listGoldItems();
  const done = completedItems(await store.listLabels({ labellerId: labeller.id }), labeller.id, TAXONOMY_VERSION);

  return (
    <main className="lab">
      <header className="lab-head">
        <p className="lab-who">
          {labeller.name} · <strong>{done.size}</strong> of {items.length} done
        </p>
        <nav className="lab-nav">
          <Link href={`/label/${token}`}>Back to labelling</Link>
        </nav>
      </header>
      <ol className="lab-card lab-list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/label/${token}?item=${item.id}`}>{item.snapshot.title}</Link>
            <span className={done.has(item.id) ? "lab-done" : "lab-todo"}>{done.has(item.id) ? "done" : "to do"}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}
