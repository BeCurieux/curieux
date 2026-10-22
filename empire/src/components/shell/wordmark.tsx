import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-baseline gap-2">
      <span className="font-serif text-2xl text-oxblood">Empire</span>{" "}
      <span className="eyebrow text-[0.65rem] text-ink-soft group-hover:text-oxblood">Studio</span>
    </Link>
  );
}
