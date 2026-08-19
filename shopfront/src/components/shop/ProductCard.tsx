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
import { cartPermalink } from "@/lib/cart/permalink";
import { isReachable } from "@/lib/render/reachable";

export interface CardContext {
  currency: string | null;
  locale: string;
  /** The merchant's storefront, for building cart permalinks. */
  storeUrl?: string;
  /** A code from the merchant's own prompt, carried into the cart. */
  discount?: string;
  /**
   * How the name and price sit under the plate. Optional so a caller with no
   * theme — a test, a fixture — gets the stacked default rather than a crash.
   */
  cardMeta?: "stacked" | "inline";
}

/**
 * Where a card goes, and what it counts as.
 *
 * A cart permalink when there is exactly one variant this could mean — the
 * brief's "one tap → pre-filled Shopify checkout" — and the product page
 * otherwise. Two cases rule the permalink out. A sold-out product must not link
 * to a cart it cannot fill, which would be the most annoying possible dead end.
 * And a product with sizes has no single right answer, so the shopper picks; see
 * `chooseCartVariant` in render/resolve.ts.
 *
 * **A null href is a third answer, and it means the card is not a link at all.**
 * The demo catalogues live on reserved names — `casalino.example`,
 * `example.invalid` — which RFC 2606 guarantees can never resolve, so every
 * card in them was offering a tap that lands nowhere. On the pages a sceptic
 * actually clicks, that is worse than a card that does not pretend to go
 * anywhere. It costs a real merchant nothing: their host is not reserved.
 */
export function cardTarget(
  product: ResolvedProduct,
  context: CardContext,
): { href: string | null; event: "product_click" | "checkout_start"; variantId?: string } {
  const soldOut = stockState(product) === "sold-out";

  if (!soldOut && product.cartVariantId && context.storeUrl && isReachable(context.storeUrl)) {
    const href = cartPermalink({
      storeUrl: context.storeUrl,
      variantId: product.cartVariantId,
      ...(context.discount ? { discount: context.discount } : {}),
    });
    if (href) return { href, event: "checkout_start", variantId: product.cartVariantId };
  }

  if (!isReachable(product.url)) return { href: null, event: "product_click" };
  return { href: product.url, event: "product_click" };
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
      {attrs && (
        // eslint-disable-next-line @next/next/no-img-element -- resizing is done
        // by the merchant's own CDN in render/image.ts; next/image would add a
        // second optimiser in front of a URL we do not host.
        <img
          {...attrs}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={eager ? "high" : "auto"}
        />
      )}
      {/* Always rendered, invisible under a photograph that arrives. Kept in
          the markup rather than swapped in on failure so the recovery is a
          class change on a plate that already contains everything it needs —
          no second render, and no flash of an empty tinted box while React
          works out what to put there. */}
      <span className="plate-initial" aria-hidden="true">
        {initial(product.title)}
      </span>
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
  const target = cardTarget(product, context);

  /*
   * A card with nowhere to go is a `<div>`, not an `<a href="">`.
   *
   * An anchor without an href is still focusable in some assistive tech and
   * still reads as a link, which would be the same lie in a quieter voice. The
   * funnel attributes go with it: a click that cannot leave the page is not a
   * `product_click`, and counting one would put invented rows in the table the
   * kill test reads.
   */
  const Card = target.href ? "a" : "div";

  return (
    <Card
      className={`card${soldOut ? " card--soldout" : ""}`}
      {...(target.href
        ? {
            href: target.href,
            // Read by the delegated listener in Funnel.tsx. Plain attributes on
            // a plain link, so the card stays a server component.
            "data-fnl": target.event,
            "data-fnl-handle": product.handle,
            ...(target.variantId ? { "data-fnl-variant": target.variantId } : {}),
          }
        : {})}
    >
      <Plate product={product} sizes={sizes} {...(eager ? { eager } : {})} />
      <div className="card-meta" data-layout={context.cardMeta ?? "stacked"}>
        <p className="card-title">{product.title}</p>
        {product.blurb && <p className="card-blurb">{product.blurb}</p>}
        <p className={`card-price${product.compareAtPrice !== undefined ? " card-price--sale" : ""}`}>
          {product.compareAtPrice !== undefined && (
            <del>{formatMoney(product.compareAtPrice, context.currency, context.locale)}</del>
          )}
          {product.priceVaries
            ? formatFrom(product.price, context.currency, context.locale)
            : formatMoney(product.price, context.currency, context.locale)}
        </p>
      </div>
    </Card>
  );
}

/** The first letter that is actually a letter — "3-Step Kit" starts with S. */
function initial(title: string): string {
  const match = /\p{L}/u.exec(title);
  return (match?.[0] ?? title.charAt(0) ?? "·").toUpperCase();
}
