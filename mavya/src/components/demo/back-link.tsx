import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="-ml-3 inline-flex h-11 w-fit items-center gap-1 rounded-full pr-4 pl-2 font-semibold text-muted transition hover:bg-surface-soft hover:text-ink [&_svg]:size-5"
    >
      <ChevronLeft aria-hidden />
      {children}
    </Link>
  );
}
