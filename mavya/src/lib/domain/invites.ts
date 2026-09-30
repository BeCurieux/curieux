import { explain, must, type Db } from "./db";

// Inviting parents to their family (docs/M6_MIGRATION_PILOT.md, M6b). The
// database decides who may invite, whose link it is and when it can be used;
// this file only calls it.

export type FamilyInvite = {
  id: string;
  email: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
  expiresAt: string;
};

export type FamilyParent = { userId: string; name: string; email: string; primary: boolean };

// Who has joined a family, and its invites still waiting.
export async function familyAccess(
  db: Db,
  familyId: string,
): Promise<{ parents: FamilyParent[]; pending: FamilyInvite[] }> {
  const [members, invites] = await Promise.all([
    db.rpc("family_parents", { p_family: familyId }),
    db
      .from("family_invites")
      .select("id, email, status, created_at, expires_at")
      .eq("family_id", familyId)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);
  return {
    parents: must(members).map((m) => ({
      userId: m.user_id,
      name: m.name,
      email: m.email,
      primary: m.is_primary_guardian,
    })),
    pending: must(invites).map((i) => ({
      id: i.id,
      email: i.email,
      status: i.status as FamilyInvite["status"],
      createdAt: i.created_at,
      expiresAt: i.expires_at,
    })),
  };
}

// Returns the code for the invite link. It isn't stored anywhere, so it can
// only be shown now.
export async function inviteParent(db: Db, familyId: string, email: string): Promise<string> {
  return must(await db.rpc("invite_parent", { p_family: familyId, p_email: email }));
}

export async function revokeInvite(db: Db, inviteId: string) {
  const { error } = await db.rpc("revoke_invite", { p_invite: inviteId });
  if (error) throw explain(error);
}

export type InviteDetails = {
  school: string;
  family: string;
  email: string;
  status: "pending" | "accepted" | "revoked" | "expired";
};

// What a link is for. Null when the code matches nothing.
export async function inviteDetails(db: Db, code: string): Promise<InviteDetails | null> {
  if (!/^[0-9a-f]{64}$/.test(code)) return null;
  const { data, error } = await db.rpc("invite_details", { p_code: code });
  if (error) throw explain(error);
  const row = data?.[0];
  return row ? { ...row, status: row.status as InviteDetails["status"] } : null;
}

// The signed-in person joins the family. Returns the family.
export async function acceptInvite(db: Db, code: string): Promise<string> {
  return must(await db.rpc("accept_invite", { p_code: code }));
}

export type SetupProgress = {
  locations: number;
  levels: number;
  makeupRules: boolean;
  instructors: number;
  classes: number;
  families: number;
  familiesJoined: number;
  invitesPending: number;
};

export async function setupProgress(db: Db, organisationId: string): Promise<SetupProgress> {
  const p = must(await db.rpc("setup_progress", { p_org: organisationId })) as Record<
    string,
    number | boolean
  >;
  return {
    locations: Number(p.locations),
    levels: Number(p.levels),
    makeupRules: Boolean(p.makeup_rules),
    instructors: Number(p.instructors),
    classes: Number(p.classes),
    families: Number(p.families),
    familiesJoined: Number(p.families_joined),
    invitesPending: Number(p.invites_pending),
  };
}

export type SetupStep = {
  key: string;
  label: string;
  done: boolean;
  href: string;
  detail?: string;
};

// The checklist on Today, in the order a school sets up. Pure, so it is
// tested directly.
export function setupSteps(p: SetupProgress): SetupStep[] {
  return [
    {
      key: "locations",
      label: "Add where you teach",
      done: p.locations > 0,
      href: "/business/settings/locations",
    },
    {
      key: "levels",
      label: "Set up your levels",
      done: p.levels > 0,
      href: "/business/settings/programs",
    },
    {
      key: "makeups",
      label: "Check your make-up rules",
      done: p.makeupRules,
      href: "/business/settings/makeups",
    },
    {
      key: "move-in",
      label: "Bring in your classes and families",
      done: p.classes > 0 && p.families > 0,
      href: "/business/settings/import",
    },
    {
      key: "invite",
      label: "Invite parents",
      done: p.familiesJoined > 0,
      href: "/business/families",
      detail:
        p.families > 0
          ? `${p.familiesJoined} of ${p.families} families have joined` +
            (p.invitesPending ? `, ${p.invitesPending} invited` : "")
          : undefined,
    },
  ];
}
