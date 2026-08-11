/**
 * The plate, and everything under it.
 *
 * Three decisions here carry most of the "flatter mediocre photography" work.
 * Every photograph is cropped to one ratio on one tint, so a catalogue of
 * mismatched shots reads as one page. A product with no photograph gets its
 * initial set huge in the display face rather than a grey rectangle, because a
 * grey rectangle is the clearest possible tell that a page was generated. And
 * the image is never filtered — the merchant's goods have to look like the
 * merchant's goods.
 */

import type { ResolvedProduct } from "@/lib/render/resolve";
import { stockState } from "@/lib/render/resolve";
import { CARD_WIDTHS, imageAttrs } from "@/lib/render/image";
import { formatFrom, formatMoney } from "@/lib/render/money";

export interface CardContext {
  currency: string | null;
  locale: string;
}

export function Plate({
  product,
  sizes,
  eager = false,
}: {
  product: ResolvedProduct;
  sizes: string;
  eager?: boolean;
}) {
  const stock = stockState(product);
  const attrs = imageAttrs(product.image, { widths: CARD_WIDTHS, sizes, alt: product.title });
  const classes = ["plate", attrs ? "" : "plate--empty", stock === "sold-out" ? "plate--soldout" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      {attrs ? (
        // eslint-disable-next-line @next/next/no-img-element -- resizing is done
        // by the merchant's own CDN in render/image.ts; next/image would add a
        // second optimiser in front of a URL we do not host.
        <img
          {...attrs}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
        />
      ) : (
        <span aria-hidden="true">{initial(product.title)}</span>
      )}
      {/* Shown and marked, never hidden. "unknown" prints nothing at all —
          claiming stock nobody checked is the same error as inventing a price. */}
      {stock === "sold-out" && <p className="stock">Sold out</p>}
    </div>
  );
}

export function ProductCard({
  product,
  context,
  sizes,
  eager,
}: {
  product: ResolvedProduct;
  context: CardContext;
  sizes: string;
  eager?: boolean;
}) {
  const soldOut = stockState(product) === "sold-out";

  return (
    <a className={`card${soldOut ? " card--soldout" : ""}`} href={product.url}>
      <Plate product={product} sizes={sizes} {...(eager ? { eager } : {})} />
      <div className="card-meta">
        <p className="card-title">{product.title}</p>
        {product.blurb && <p className="card-blurb">{product.blurb}</p>}
        <p className="card-price">
          {product.compareAtPrice !== undefined && (
            <del>{formatMoney(product.compareAtPrice, context.currency, context.locale)}</del>
          )}
          {product.priceVaries
            ? formatFrom(product.price, context.currency, context.locale)
            : formatMoney(product.price, context.currency, context.locale)}
        </p>
      </div>
    </a>
  );
}

/** The first letter that is actually a letter — "3-Step Kit" starts with S. */
function initial(title: string): string {
  const match = /\p{L}/u.exec(title);
  return (match?.[0] ?? title.charAt(0) ?? "·").toUpperCase();
}
