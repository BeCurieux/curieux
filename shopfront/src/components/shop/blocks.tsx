/**
 * One component per block in the closed set.
 *
 * Every one of them takes references and returns markup — the block chooses
 * *what* and this file decides *how it looks*, which is the line the whole
 * architecture rests on. A block that resolves to nothing renders nothing:
 * a product can leave a catalogue between publishing and opening, and a
 * shorter page is better for the merchant than a card that 404s.
 */

import { Block as BlockSchema } from "@/lib/schema";
import type { z } from "zod";

type Block = z.infer<typeof BlockSchema>;
import type { Catalogue } from "@/lib/ingest/types";
import { resolveAll, resolveProduct } from "@/lib/render/resolve";
import { HERO_WIDTHS, imageAttrs } from "@/lib/render/image";
import { ProductCard, Plate, type CardContext } from "./ProductCard";
import { HeartScribble, Sparkle } from "./marks";
import { OfferCode } from "./OfferCode";
import type { MoodShape } from "@/lib/render/theme";

export interface BlockContext extends CardContext {
  catalogue: Catalogue;
  shape: MoodShape;
  brandName: string;
}

const GRID_SIZES = "(min-width: 760px) 33vw, 45vw";
const STACK_SIZES = "(min-width: 760px) 55vw, 92vw";
const CAROUSEL_SIZES = "(min-width: 760px) 30vw, 68vw";

export function BlockView({ id, block, context }: { id: string; block: Block; context: BlockContext }) {
  switch (block.type) {
    case "hero":
      return <Hero block={block} context={context} />;
    case "productGrid":
      return <ProductGrid id={id} block={block} context={context} />;
    case "routine":
      return <Routine id={id} block={block} context={context} />;
    case "drop":
      return <Drop id={id} block={block} context={context} />;
    case "offer":
      return <Offer block={block} />;
    case "linkList":
      return <LinkList block={block} />;
    // Reviews and capture are in the schema and are deliberately never
    // rendered. No review data is ingestable from a public storefront, and
    // nothing is wired to receive an email address — a page carrying either
    // would be making a promise the product cannot keep.
    case "reviews":
    case "capture":
      return null;
  }
}

function SectionHead({ title, count }: { title?: string | undefined; count?: number }) {
  if (!title) return null;
  return (
    <div className="section-head">
      <h2 className="display">{title}</h2>
      <Sparkle />
      <div className="rule" />
      {/* The count is an editorial gesture that happens to be useful: a thumb
          decides whether to keep scrolling a section before it starts. */}
      {count !== undefined && count > 1 && <span className="count">{count}</span>}
    </div>
  );
}

function Hero({ block, context }: { block: Extract<Block, { type: "hero" }>; context: BlockContext }) {
  const media = block.media;
  const productMedia =
    media?.kind === "productImage" ? resolveProduct({ handle: media.handle }, context.catalogue) : null;

  const image =
    media?.kind === "brandAsset"
      ? { url: media.url }
      : media?.kind === "productImage" && productMedia
        ? (productMedia.images[media.imageIndex] ?? productMedia.images[0])
        : undefined;

  const attrs = imageAttrs(image, {
    widths: HERO_WIDTHS,
    sizes: "100vw",
    alt: productMedia?.title ?? context.brandName,
  });

  const classes = [
    "hero",
    context.shape.heroFullBleed ? "hero--bleed" : "",
    attrs ? "" : "hero--nomedia",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes}>
      <div className="hero-plate">
        {/* The one image above the fold: eager, high priority, and the only
            place on the page where that is worth the bytes. */}
        {attrs && <img {...attrs} loading="eager" fetchPriority="high" decoding="async" />}
        <div className="hero-copy">
          <h1 className="display">{block.headline}</h1>
          {block.subline && <p className="subline">{block.subline}</p>}
          {block.cta && (
            <a className="cta" href={block.cta.targetBlockId ? `#${block.cta.targetBlockId}` : block.cta.url}>
              {block.cta.label}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function ProductGrid({
  id,
  block,
  context,
}: {
  id: string;
  block: Extract<Block, { type: "productGrid" }>;
  context: BlockContext;
}) {
  const products = resolveAll(block.products, context.catalogue);
  if (products.length === 0) return null;

  const sizes = block.layout === "carousel" ? CAROUSEL_SIZES : block.layout === "stack" ? STACK_SIZES : GRID_SIZES;

  return (
    <section id={id}>
      <SectionHead title={block.title} count={products.length} />
      <div className={block.layout}>
        {products.map((product) => (
          <ProductCard key={product.handle} product={product} context={context} sizes={sizes} />
        ))}
      </div>
    </section>
  );
}

function Drop({
  id,
  block,
  context,
}: {
  id: string;
  block: Extract<Block, { type: "drop" }>;
  context: BlockContext;
}) {
  const products = resolveAll(block.products, context.catalogue);
  if (products.length === 0) return null;

  // A launch date only ever arrives here from the merchant's own brief — the
  // validator rejects an invented one. Before the date the products are the
  // preview; the countdown itself is a Sprint 3 decision, so this states the
  // date plainly rather than animating a clock nobody wired.
  const launch = block.launchesAt ? new Date(block.launchesAt) : null;
  const upcoming = launch !== null && launch.getTime() > Date.now();

  return (
    <section id={id}>
      <div className="section-head">
        <h2 className="display">{block.title}</h2>
        <div className="rule" />
        {upcoming && launch && (
          <p className="eyebrow">
            {launch.toLocaleDateString("en", { day: "numeric", month: "long" })}
          </p>
        )}
      </div>
      {/* Stack is the single-product treatment. Two full-width plates on a
          phone is most of a screen each, which reads as padding rather than
          emphasis. */}
      <div className={products.length > 1 ? "grid" : "stack"}>
        {products.map((product) => (
          <ProductCard
            key={product.handle}
            product={product}
            context={context}
            sizes={products.length > 1 ? GRID_SIZES : STACK_SIZES}
          />
        ))}
      </div>
    </section>
  );
}

function Routine({
  id,
  block,
  context,
}: {
  id: string;
  block: Extract<Block, { type: "routine" }>;
  context: BlockContext;
}) {
  const steps = block.steps
    .map((step) => ({ label: step.label, product: resolveProduct(step.product, context.catalogue) }))
    .filter((step): step is { label: string; product: NonNullable<typeof step.product> } => step.product !== null);
  if (steps.length === 0) return null;

  return (
    <section id={id}>
      <SectionHead title={block.title} count={steps.length} />
      <div className="routine">
        {steps.map((step, index) => (
          <div className="step" key={step.product.handle}>
            {/* The number is the point of this block — it is the one place the
                order of the products is the merchandising. */}
            <div className="step-index">{index + 1}</div>
            <a className="card step-body" href={step.product.url}>
              <Plate product={step.product} sizes="(min-width: 760px) 160px, 108px" />
              <div className="card-meta">
                <p className="step-label">{step.label}</p>
                <p className="card-title">{step.product.title}</p>
                {step.product.blurb && <p className="card-blurb">{step.product.blurb}</p>}
              </div>
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function Offer({ block }: { block: Extract<Block, { type: "offer" }> }) {
  return (
    <section className="offer">
      <p>{block.description}</p>
      <OfferCode code={block.code} />
      <HeartScribble className="offer-mark" />
    </section>
  );
}

function LinkList({ block }: { block: Extract<Block, { type: "linkList" }> }) {
  return (
    <nav className="links">
      {block.links.map((link) => (
        <a key={link.url} href={link.url}>
          <span>{link.label}</span>
          <span aria-hidden="true">→</span>
        </a>
      ))}
    </nav>
  );
}
