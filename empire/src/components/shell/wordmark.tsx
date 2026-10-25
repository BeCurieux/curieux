import Link from "next/link";

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-baseline gap-2">
      <span className="text-aubergine font-serif text-2xl">Empire</span>{" "}
      <span className="eyebrow text-mute group-hover:text-aubergine text-[0.65rem]">Studio</span>
    </Link>
  );
}
