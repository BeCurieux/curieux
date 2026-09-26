/**
 * The labelling page: one product, every Genome dimension, one save.
 *
 * Two external merchandisers build the gold set here, from an invite link,
 * without repo access. The gold set is what gates the whole ontology, so the
 * page is shaped around keeping their labels independent and honest:
 *
 * - **Blind.** It never shows the model's answer or the other labeller's.
 * - **The spec, verbatim.** Every option shows the definition the classifier
 *   is prompted with, from the same source (`lib/genome/v1/taxonomy.ts`), and
 *   the full spec with the global rules is one tap away.
 * - **Unknown is a first-class answer**, on every dimension, because forcing
 *   a value on thin evidence is the error the taxonomy exists to avoid.
 * - **No JavaScript needed.** A plain form posts to `api/label`, which
 *   redirects back here with the next product. It works on a phone, on a slow
 *   connection, and with nothing to break.
 *
 * Internal: `noindex`, `no-referrer`, and a 404 for any link that is not a
 * live invite.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { completedItems, nextItem } from "@/lib/genome/v1/gold";
import { dimension, MODEL_DIMENSIONS, TAXONOMY_VERSION, UNKNOWN } from "@/lib/genome/v1/taxonomy";
import { sizedImageUrl } from "@/lib/render/image";
import { labellerFor, PRIVATE_PAGE } from "./access";
import "../label.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Labelling — popuup", ...PRIVATE_PAGE };

type Search = Promise<{ item?: string; error?: string; saved?: string }>;

export default async function LabelPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Search }) {
  const { token } = await params;
  const search = await searchParams;
  const { store, labeller } = await labellerFor(token);

  const items = await store.listGoldItems();
  const labels = await store.listLabels({ labellerId: labeller.id });
  const done = completedItems(labels, labeller.id, TAXONOMY_VERSION);
  const item = (search.item ? items.find((i) => i.id === search.item) : null) ?? nextItem(items, done);

  const base = `/label/${token}`;
  const header = (
    <header className="lab-head">
      <p className="lab-who">
        {labeller.name} · <strong>{done.size}</strong> of {items.length} done
      </p>
      <nav className="lab-nav">
        <Link href={`${base}/spec`}>The spec</Link>
        <Link href={`${base}/items`}>All products</Link>
      </nav>
    </header>
  );

  if (!item) {
    return (
      <main className="lab">
        {header}
        <section className="lab-card lab-finished">
          <h1>{items.length ? "All done." : "Nothing to label yet."}</h1>
          <p>
            {items.length
              ? "Every product has an answer on every dimension. You can still revisit any of them from the list."
              : "The gold set has not been loaded. There is nothing for you to do until it is."}
          </p>
        </section>
      </main>
    );
  }

  const mine = new Map(labels.filter((l) => l.itemId === item.id && l.taxonomyVersion === TAXONOMY_VERSION).map((l) => [l.dimension, l.labels]));
  const s = item.snapshot;
  const price = s.price === null ? null : `${s.price.toFixed(2)}${s.currency ? ` ${s.currency}` : ""}`;

  return (
    <main className="lab">
      {header}

      {search.saved && !search.error ? <p className="lab-note">Saved.</p> : null}
      {search.error ? (
        <p className="lab-error" role="alert">
          {search.error}
        </p>
      ) : null}

      <article className="lab-card lab-product">
        {s.images.length ? (
          <div className="lab-images">
            {s.images.map((src) => (
              // Plain <img>: the merchant's CDN resizes, and there is no
              // optimiser configured to put in front of it.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={sizedImageUrl(src, 600)} alt="" loading="lazy" referrerPolicy="no-referrer" />
            ))}
          </div>
        ) : (
          <p className="lab-muted">No photographs.</p>
        )}
        <h1 className="lab-title">{s.title}</h1>
        <dl className="lab-facts">
          {price ? (
            <>
              <dt>Price</dt>
              <dd>{price}</dd>
            </>
          ) : null}
          {s.productType ? (
            <>
              <dt>Type</dt>
              <dd>{s.productType}</dd>
            </>
          ) : null}
          {s.vendor ? (
            <>
              <dt>Brand</dt>
              <dd>{s.vendor}</dd>
            </>
          ) : null}
          {s.options.length ? (
            <>
              <dt>Options</dt>
              <dd>{s.options.join(", ")}</dd>
            </>
          ) : null}
          {s.tags.length ? (
            <>
              <dt>Tags</dt>
              <dd>{s.tags.join(", ")}</dd>
            </>
          ) : null}
        </dl>
        {s.description ? <p className="lab-description">{s.description}</p> : <p className="lab-muted">No description.</p>}
      </article>

      <form className="lab-form" method="post" action="/api/label">
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="item" value={item.id} />

        {MODEL_DIMENSIONS.map((id) => {
          const d = dimension(id);
          const multi = d.cardinality === "multi";
          const chosen = new Set(mine.get(id) ?? []);
          const options = [...d.values, { id: UNKNOWN, label: "Unknown", definition: "The listing does not support any answer above, or the evidence is genuinely split." }];
          return (
            <fieldset key={id} className="lab-dim">
              <legend>
                {d.label}
                <span className="lab-rule">{multi ? (d.maxLabels ? `Choose up to ${d.maxLabels}` : "Choose all that apply") : "Choose one"}</span>
              </legend>
              <p className="lab-question">{d.question}</p>
              {d.boundaryRules.map((rule) => (
                <p key={rule} className="lab-boundary">
                  {rule}
                </p>
              ))}
              {options.map((o) => (
                <label key={o.id} className="lab-option">
                  <input type={multi ? "checkbox" : "radio"} name={id} value={o.id} defaultChecked={chosen.has(o.id)} required={!multi} />
                  <span>
                    <strong>{o.label}</strong>
                    <small>{o.definition}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          );
        })}

        <button type="submit" className="lab-save">
          Save and next
        </button>
      </form>
    </main>
  );
}
