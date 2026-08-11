/**
 * The whole page.
 *
 * `ShopConfig` in, one template out — no branching on brand, category or block
 * count beyond what the tokens already say. The theme arrives as inline custom
 * properties on the root, which is what lets a single stylesheet serve every
 * shop without a build step per merchant.
 */

import type { ShopConfig } from "@/lib/schema";
import type { Catalogue } from "@/lib/ingest/types";
import { buildTheme } from "@/lib/render/theme";
import { BlockView } from "./blocks";

export interface ShopProps {
  config: ShopConfig;
  /** Live catalogue. Prices and stock are read from here, never from the config. */
  catalogue: Catalogue;
  /** When that catalogue was read. Printed, because it is not live yet. */
  ingestedAt?: string;
  locale?: string;
}

export function Shop({ config, catalogue, ingestedAt, locale = "en" }: ShopProps) {
  const theme = buildTheme(config.theme);

  return (
    <div className="shop" data-dark={theme.dark} style={theme.variables as React.CSSProperties}>
      <div className="wrap">
        <header className="masthead">
          {config.brand.logoUrl ? (
            <img src={config.brand.logoUrl} alt={config.brand.name} />
          ) : (
            <span className="name">{config.brand.name}</span>
          )}
          {config.brand.tagline && <p className="tagline">{config.brand.tagline}</p>}
        </header>

        {config.blocks.map((entry, index) => (
          <div
            className="block"
            key={entry.id}
            // Drives the staggered page-load reveal in shop.css.
            style={{ "--i": index } as React.CSSProperties}
          >
            <BlockView
              id={entry.id}
              block={entry.block}
              context={{
                catalogue,
                currency: catalogue.currency,
                locale,
                shape: theme.shape,
                brandName: config.brand.name,
              }}
            />
          </div>
        ))}

        {/*
          The honest footer.

          No "always in sync", no "live inventory" — the brief is explicit that
          nothing may claim a connection that is not wired, and the footer is
          exactly where a product like this would be tempted to claim one.

          The dateline is the positive form of the same rule. Until OAuth sync
          exists the catalogue is a snapshot, and a shopper reading a price
          that was true three weeks ago is owed that fact. It is the one line
          on the page a merchant might want removed, and it should be their
          call to remove rather than ours to omit.
        */}
        <footer className="colophon">
          <span>{config.brand.name}</span>
          <a href={config.brand.storeUrl}>Visit the full store →</a>
          {ingestedAt && (
            <span className="asof">
              Prices and availability as of{" "}
              {new Date(ingestedAt).toLocaleDateString(locale, { day: "numeric", month: "long" })}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
