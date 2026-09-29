import { NavLink } from "./nav-link";

const ITEMS = [
  { href: "/business", label: "Today", exact: true, also: ["/business/fill"] },
  { href: "/business/classes", label: "Classes" },
  { href: "/business/families", label: "Families" },
  { href: "/business/progress", label: "Progress" },
  { href: "/business/settings", label: "Settings" },
];

export function BusinessNav() {
  return (
    <nav aria-label="Business" className="-mx-1 overflow-x-auto">
      <ul className="flex gap-1 px-1">
        {ITEMS.map(({ href, label, exact, also }) => (
          <li key={href}>
            <NavLink
              href={href}
              exact={exact}
              also={also}
              className="flex h-10 items-center rounded-full px-4 text-[15px] font-semibold whitespace-nowrap text-muted transition hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-white"
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
