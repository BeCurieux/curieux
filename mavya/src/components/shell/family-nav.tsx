import { CalendarDays, House, MessageCircle, Smile, UserRound } from "lucide-react";
import { NavLink } from "./nav-link";

const ITEMS = [
  { href: "/family", label: "Home", icon: House, exact: true },
  { href: "/family/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/family/kids", label: "Kids", icon: Smile },
  { href: "/family/messages", label: "Messages", icon: MessageCircle },
  { href: "/family/account", label: "Account", icon: UserRound },
];

// Bottom tab bar, thumb-reachable on a phone.
export function FamilyNav() {
  return (
    <nav
      aria-label="Family"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line/70 bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, exact }) => (
          <li key={href}>
            <NavLink
              href={href}
              exact={exact}
              className="group flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-muted aria-[current=page]:text-ink"
            >
              <span className="grid h-8 w-12 place-items-center rounded-full transition group-aria-[current=page]:bg-lilac/35 [&_svg]:size-[22px]">
                <Icon aria-hidden strokeWidth={2.25} />
              </span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
