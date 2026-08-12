/**
 * The workbench, not a product surface.
 *
 * Everything generated so far, so that looking at four shops side by side is
 * one click rather than four commands. It is a development tool and it says
 * so — the published shops are the product; this is the bench they sit on.
 *
 * It wears popuup's own brand rather than a merchant's, and the cards show the
 * theme tokens each shop got: reading five moods across a dozen shops is the
 * comparison this page exists for.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { listShops } from "@/lib/render/store";
import { workbenchVisible } from "@/lib/workbench";
import { Sparkle } from "@/components/shop/marks";
import "./workbench.css";

export const dynamic = "force-dynamic";

export default async function Index() {
  // A 404 rather than a redirect or a holding page: in a production build there
  // is no page here, and saying so is more honest than sending a shopper
  // somewhere they did not ask for. `WORKBENCH=1` puts it back — see
  // `lib/workbench.ts`.
  if (!workbenchVisible()) notFound();

  const shops = await listShops();

  return (
    <main className="bench">
      <div className="bench-inner">
        <p className="bench-mark">
          pop<em>uu</em>p
        </p>

        <span className="bench-chip">
          <Sparkle className="" />
          Workbench
        </span>

        <h1>
          Every shop <em>generated</em> so far.
        </h1>

        <p className="bench-lede">
          Nothing here is published. These read from the local cache — step 4 is what gives a shop a URL.
        </p>

        <code className="bench-command">pnpm merchandise &lt;store-url&gt; &quot;&lt;prompt&gt;&quot; --render</code>

        {shops.length === 0 ? (
          <p className="bench-empty">Nothing generated yet.</p>
        ) : (
          <ul className="bench-list">
            {shops.map((shop) => (
              <li key={shop.key}>
                <Link className="bench-card" href={`/preview/${shop.key}`}>
                  <h2>{shop.name}</h2>
                  <p className="prompt">{shop.prompt}</p>

                  <div className="bench-swatches">
                    <span style={{ background: shop.theme.colorway.background }} />
                    <span style={{ background: shop.theme.colorway.surface }} />
                    <span style={{ background: shop.theme.colorway.accent }} />
                  </div>

                  <div className="bench-tags">
                    <span className="bench-tag" data-kind="mood">
                      {shop.theme.mood}
                    </span>
                    <span className="bench-tag" data-kind="type">
                      {shop.theme.typography}
                    </span>
                    <span className="bench-tag" data-kind="blocks">
                      {shop.blocks} blocks
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
