// Who may do what in a shared archive.
//
// The database enforces access — you cannot read a family you are not in.
// This module decides the finer question of what a member may *do*, and it
// lives in TypeScript so it can be tested exhaustively without a Postgres
// instance, and so every screen asks the same question the same way.
//
// The important rule, and the reason moderation exists at all: a contributor
// can add to the archive but cannot put anything into the book. The owner is
// answerable for every word and photograph printed about their child, so
// nothing reaches the page without them saying yes. That is the never-invent
// rule extended from the model to the family.

export type FamilyRole = "owner" | "editor" | "contributor";

export type ContributionStatus = "approved" | "pending" | "declined";

/**
 * Who a memory is for.
 *
 * `family` — everyone with access, once approved. The normal case.
 * `private` — only whoever wrote it. Not the other parent, not the owner.
 *             A privacy control that the account holder can read through is
 *             not a privacy control.
 */
export type MemoryVisibility = "family" | "private";

/** Said at the moment of choosing, because the consequence is not obvious. */
export const PRIVATE_BLURB =
  "Only you can see this. It stays out of the book and nobody else in the " +
  "family will ever see it — you can share it later if you change your mind.";

export const ROLE_LABEL: Record<FamilyRole, string> = {
  owner: "Keeps the archive",
  editor: "Adds anything",
  contributor: "Adds, you approve",
};

export const ROLE_BLURB: Record<FamilyRole, string> = {
  owner:
    "Approves what goes in the book, manages who has access, and orders the printing.",
  editor:
    "The other parent. Adds photos, quotes and notes directly — nothing waits for approval.",
  contributor:
    "Grandparents, godparents, anyone who knows them. What they add waits for you before it can reach the book.",
};

/** Roles that can be handed out by invitation. Ownership is not one of them. */
export const INVITABLE_ROLES: FamilyRole[] = ["editor", "contributor"];

const RANK: Record<FamilyRole, number> = { contributor: 1, editor: 2, owner: 3 };

const atLeast = (role: FamilyRole | null, min: FamilyRole): boolean =>
  role !== null && RANK[role] >= RANK[min];

/** Anyone in the family can look at the archive. */
export const canRead = (role: FamilyRole | null) => role !== null;

/** Anyone in the family can add something. What happens to it differs. */
export const canContribute = (role: FamilyRole | null) => role !== null;

/** Editing the book, the little things, the questions. */
export const canEdit = (role: FamilyRole | null) => atLeast(role, "editor");

/** Accepting or declining what a contributor added. */
export const canModerate = (role: FamilyRole | null) => atLeast(role, "editor");

/** Inviting, changing roles, removing access. */
export const canManageAccess = (role: FamilyRole | null) => atLeast(role, "owner");

/** Sending a book to print and paying for it. */
export const canApprovePrint = (role: FamilyRole | null) => atLeast(role, "owner");

/** Anyone in the family can join the conversation. */
export const canComment = (role: FamilyRole | null) => role !== null;

/**
 * What a new memory's status should be, given who added it.
 * Contributions wait; the people answerable for the book do not.
 */
export function statusForNewMemory(role: FamilyRole | null): ContributionStatus {
  if (role === null) throw new Error("not a member of this family");
  return canEdit(role) ? "approved" : "pending";
}

/**
 * Whether a given member may see a given memory. Approved content is shared;
 * something still waiting is visible to whoever added it and to whoever will
 * decide on it, and to nobody else — a half-considered contribution should
 * not appear in the family's archive before it has been accepted.
 */
export function canSeeMemory(
  role: FamilyRole | null,
  memory: {
    contributionStatus: ContributionStatus;
    createdBy: string;
    visibility?: MemoryVisibility;
  },
  viewerUserId: string
): boolean {
  if (role === null) return false;

  // Private wins over everything, including moderation rights. Checked first
  // so no later branch can hand a private note to somebody else.
  if ((memory.visibility ?? "family") === "private") {
    return memory.createdBy === viewerUserId;
  }

  if (memory.contributionStatus === "approved") return true;
  if (memory.createdBy === viewerUserId) return true;
  return canModerate(role);
}

/**
 * Whether a member may change or withdraw a memory. A contributor may correct
 * their own while it is still waiting; once it has been accepted it belongs to
 * the archive and only an editor may touch it.
 */
export function canEditMemory(
  role: FamilyRole | null,
  memory: {
    contributionStatus: ContributionStatus;
    createdBy: string;
    visibility?: MemoryVisibility;
  },
  viewerUserId: string
): boolean {
  if (role === null) return false;
  // Nobody edits what they cannot see.
  if ((memory.visibility ?? "family") === "private") {
    return memory.createdBy === viewerUserId;
  }
  if (canEdit(role)) return true;
  return memory.createdBy === viewerUserId && memory.contributionStatus === "pending";
}

/**
 * Everything eligible for the printed page.
 *
 * Two filters, and both matter. Unapproved contributions are held back
 * because the parent is answerable for the book. Private notes are held back
 * because the book is *shared* — the family reads it and extra copies go to
 * grandparents, so a private note on page forty would be the most complete
 * failure this feature could have.
 */
export function eligibleForBook<
  T extends { contribution_status?: ContributionStatus; visibility?: MemoryVisibility }
>(memories: T[]): T[] {
  return memories.filter(
    (m) =>
      (m.contribution_status ?? "approved") === "approved" &&
      (m.visibility ?? "family") === "family"
  );
}
