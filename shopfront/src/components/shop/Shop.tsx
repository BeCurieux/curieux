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
import { creditLine, type Creator } from "@/lib/creator";
import { buildTheme } from "@/lib/render/theme";
import { BlockView } from "./blocks";
import { Badge } from "./Badge";
import { BrokenImagery } from "./BrokenImagery";
import { Funnel } from "./Funnel";
import { isReachable } from "@/lib/render/reachable";

export interface ShopProps {
  config: ShopConfig;
  /** Live catalogue. Prices and stock are read from here, never from the config. */
  catalogue: Catalogue;
  /** When that catalogue was read. Printed, because it is not live yet. */
  ingestedAt?: string;
  locale?: string;
  /**
   * Free-tier shops carry the badge. Pro removes it, and that is most of what
   * the paid tier is for — so the default is `true`: a caller that forgets to
   * pass a plan ships the badge rather than quietly giving away the tier.
   */
  badge?: boolean;
  /** For the badge's UTM, so the install loop is measurable. */
  slug?: string;
  /**
   * Whose audience this shop was made for.
   *
   * A separate prop rather than a field on `config` on purpose: this is the one
   * thing on the page naming a real person, and it must not be reachable by a
   * model. See `lib/creator.ts`.
   */
  creator?: Creator | null;
}

export function Shop({
  config,
  catalogue,
  ingestedAt,
  locale = "en",
  badge = true,
  slug,
  creator = null,
}: ShopProps) {
  const theme = buildTheme(config.theme);

  // The first offer code on the page rides along on every cart permalink. It
  // came from the merchant's own brief — the validator rejects an invented one —
  // so applying it is carrying their instruction through, not a claim the page
  // is making.
  const discount = config.blocks.find((entry) => entry.block.type === "offer")?.block as
    | { type: "offer"; code: string }
    | undefined;

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

        {/*
          The credit, directly under the brand and above everything else.

          High on the page because it is the reason a shopper trusts the
          selection — somebody they follow picked these — and burying it in the
          footer would be keeping the fact and throwing away its value.

          It says "chosen by" and stops. Not "in partnership with", not
          "exclusive", not a discount code: this system knows that a person's
          name was passed at publish time and knows nothing at all about the
          commercial arrangement behind it, so anything warmer would be a claim
          made on somebody else's behalf.
        */}
        {creator && (
          <p className="credit">
            {creator.url ? (
              <a href={creator.url} target="_blank" rel="noopener">
                {creditLine(creator)}
              </a>
            ) : (
              creditLine(creator)
            )}
          </p>
        )}

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
                cardMeta: theme.shape.cardMeta,
                brandName: config.brand.name,
                storeUrl: config.brand.storeUrl,
                ...(discount ? { discount: discount.code } : {}),
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
          {/* Offered only when there is a store to visit. The demo brands are on
              reserved names that cannot resolve, so this would be an invitation
              to a 404 from the one line of the page that speaks for the
              merchant. */}
          {isReachable(config.brand.storeUrl) && <a href={config.brand.storeUrl}>Visit the full store →</a>}
          {ingestedAt && (
            <span className="asof">
              Prices and availability as of{" "}
              {new Date(ingestedAt).toLocaleDateString(locale, { day: "numeric", month: "long" })}
            </span>
          )}
        </footer>

        {badge && <Badge {...(slug ? { slug } : {})} />}

        {/* Unconditional, unlike the funnel below: a photograph that fails to
            load is a rendering problem, and a preview is exactly where the
            merchant should find out about it. */}
        <BrokenImagery />

        {/* Only a published shop records anything. A preview has no slug, and
            counting developer reloads as merchant traffic would poison the one
            number the merchant is going to judge this on. */}
        {slug && <Funnel slug={slug} />}
      </div>
    </div>
  );
}
