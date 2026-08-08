/**
 * Interface primitives (§37).
 *
 * shadcn-style: components we own, in our repo, built on Tailwind and CVA
 * rather than pulled from a package. The brief asks for shadcn/ui; this is
 * what that gives you once the CLI has run, minus a Radix dependency we do not
 * need for a surface this small.
 *
 * The design brief is premium, warm, editorial, calm — a lifestyle product
 * rather than SaaS (§36). Practically that means: generous space, one accent,
 * hairline rules instead of boxes, and type doing the work that colour and
 * shadow do in a dashboard.
 */

import { cva, type VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PRODUCT_NAME } from "@/config/brand";

// ------------------------------------------------------------ BrandLogo

/**
 * The wordmark reads from brand config, so a rename never leaves a stale name
 * in the header. Letterspaced small caps rather than a graphic: the product
 * name is provisional and a logo would be premature.
 */
export function BrandLogo({
  className,
  href = "/",
}: {
  className?: string;
  href?: string | null;
}) {
  const mark = (
    <span
      className={cn(
        "font-sans text-[13px] font-semibold uppercase tracking-[0.2em] text-forest",
        className
      )}
    >
      {PRODUCT_NAME}
    </span>
  );
  return href ? (
    <Link href={href} aria-label={`${PRODUCT_NAME} home`}>
      {mark}
    </Link>
  ) : (
    mark
  );
}

// ------------------------------------------------------------ Button

const buttonStyles = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-sans font-semibold " +
    "transition-colors disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary: "bg-forest text-white hover:bg-[#1b4033] active:bg-[#173629]",
        secondary: "bg-white text-ink border border-rule hover:bg-[#FCFAF6] active:bg-[#F5F1EA]",
        ghost: "text-graphite hover:text-ink hover:bg-[#F3EFE8]",
        clay: "bg-clay text-white hover:bg-[#9d5429]",
        danger: "bg-white text-[#8C2F1E] border border-[#E6C7BE] hover:bg-[#FBF1EE]",
      },
      size: {
        // 48px minimum: this is a phone product used with a thumb.
        md: "h-12 px-5 text-[15px]",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-7 text-base",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  }
);

export interface ButtonProps
  extends ComponentProps<"button">,
    VariantProps<typeof buttonStyles> {}

export function Button({ className, variant, size, block, ...props }: ButtonProps) {
  return <button className={cn(buttonStyles({ variant, size, block }), className)} {...props} />;
}

export function ButtonLink({
  className,
  variant,
  size,
  block,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof buttonStyles>) {
  return <Link className={cn(buttonStyles({ variant, size, block }), className)} {...props} />;
}

// ------------------------------------------------------------ Chip

/**
 * The onboarding workhorse (§9: large visual choices rather than forms). Big
 * enough to hit, quiet enough that thirty of them do not shout.
 */
export function Chip({
  selected,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-4 py-2.5 text-[15px] transition-colors",
        selected
          ? "border-forest bg-forest text-white"
          : "border-rule bg-white text-graphite hover:border-[#CFC7B8] hover:text-ink",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------ ChoiceCard

/** A larger single choice, with room for a line of explanation. */
export function ChoiceCard({
  selected,
  title,
  description,
  icon,
  className,
  ...props
}: ComponentProps<"button"> & {
  selected?: boolean;
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cn(
        "flex w-full items-start gap-3 rounded-card border p-4 text-left transition-colors",
        selected
          ? "border-forest bg-sage"
          : "border-rule bg-white hover:border-[#CFC7B8]",
        className
      )}
      {...props}
    >
      {icon ? <span className="mt-0.5 text-lg leading-none">{icon}</span> : null}
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-sm leading-snug text-mist">{description}</span>
        ) : null}
      </span>
    </button>
  );
}

// ------------------------------------------------------------ ProgressBar

export function ProgressBar({ step, total }: { step: number; total: number }) {
  const percent = Math.round((step / total) * 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`Step ${step} of ${total}`}
      className="h-1 w-full overflow-hidden rounded-full bg-rule"
    >
      <div
        className="h-full rounded-full bg-forest transition-[width] duration-500 ease-out"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// ------------------------------------------------------------ Badges

const badgeStyles = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-[#F3EFE8] text-graphite",
        water: "bg-washedWash text-washed",
        clay: "bg-clayWash text-clay",
        forest: "bg-sage text-forest",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

export function Badge({
  tone,
  className,
  children,
}: VariantProps<typeof badgeStyles> & { className?: string; children: ReactNode }) {
  return <span className={cn(badgeStyles({ tone }), className)}>{children}</span>;
}

// ------------------------------------------------------------ Card & layout

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-card border border-rule bg-card shadow-card", className)}
      {...props}
    />
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mist">{children}</p>
  );
}

export function PageTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h1 className={cn("text-[28px] leading-[1.15] text-ink sm:text-[34px]", className)}>
      {children}
    </h1>
  );
}

// ------------------------------------------------------------ EmptyState

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-rule px-6 py-12 text-center">
      <h3 className="text-xl text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-prose text-[15px] leading-relaxed text-mist">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
