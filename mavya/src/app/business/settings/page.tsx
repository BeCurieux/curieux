import {
  ArrowRight,
  CalendarRange,
  CalendarX,
  History,
  Layers,
  MapPin,
  RefreshCcw,
  Upload,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/business/owner";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  {
    href: "/business/settings/locations",
    icon: MapPin,
    title: "Locations",
    body: "Where your classes happen.",
  },
  {
    href: "/business/settings/programs",
    icon: Layers,
    title: "Programs & levels",
    body: "What children learn, in order.",
  },
  {
    href: "/business/settings/makeups",
    icon: RefreshCcw,
    title: "Make-up rules",
    body: "Notice, how long credits last, and where they can be used.",
  },
  {
    href: "/business/settings/terms",
    icon: CalendarRange,
    title: "Terms",
    body: "Your term dates, and asking families who's staying next term.",
  },
  {
    href: "/business/settings/cancel",
    icon: CalendarX,
    title: "Cancel lessons",
    body: "Pool closed? Cancel a day and every child gets a credit.",
  },
  {
    href: "/business/settings/staff",
    icon: Users,
    title: "Staff",
    body: "Who can sign in, and removing access.",
  },
  {
    href: "/business/settings/import",
    icon: Upload,
    title: "Move your school in",
    body: "Bring your classes and families from your current system.",
  },
  {
    href: "/business/settings/activity",
    icon: History,
    title: "Activity",
    body: "Every change, and who made it.",
  },
];

export default async function SettingsPage() {
  const { organisationName } = await requireOwner();
  return (
    <div className="rise flex flex-col gap-6">
      <div>
        <p className="font-semibold text-muted">{organisationName}</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Settings</h1>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(({ href, icon: Icon, title, body }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-5 transition hover:border-ink"
            >
              <span className="grid size-11 place-items-center rounded-full bg-surface-soft [&_svg]:size-5">
                <Icon aria-hidden />
              </span>
              <span className="flex items-center justify-between gap-2 font-display text-xl font-semibold">
                {title}
                <ArrowRight aria-hidden className="size-5 text-muted" />
              </span>
              <span className="text-muted">{body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
