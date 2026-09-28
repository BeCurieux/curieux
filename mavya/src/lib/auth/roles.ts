// Which app shells a person may open, derived from what the database says
// they are. Pure, so it is tested directly (tests/unit/roles.test.ts).
//
// "Parent" is not a stored role: it is anyone who belongs to a family. Staff
// roles come from active staff memberships.

export type Shell = "business" | "instructor" | "family";
export type StaffRole = "owner" | "instructor";

export type Memberships = {
  staffRoles: readonly StaffRole[];
  familyCount: number;
};

// Also the landing priority for someone with several roles.
const SHELL_ORDER: readonly Shell[] = ["business", "instructor", "family"];

export const SHELL_PATHS: Record<Shell, string> = {
  business: "/business",
  instructor: "/instructor",
  family: "/family",
};

export function availableShells({ staffRoles, familyCount }: Memberships): Shell[] {
  const held = new Set<Shell>();
  if (staffRoles.includes("owner")) held.add("business");
  if (staffRoles.includes("instructor")) held.add("instructor");
  if (familyCount > 0) held.add("family");
  return SHELL_ORDER.filter((shell) => held.has(shell));
}

export function homePath(shells: readonly Shell[]): string {
  const first = shells[0];
  return first ? SHELL_PATHS[first] : "/no-access";
}
