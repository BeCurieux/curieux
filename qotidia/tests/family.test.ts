// The shared archive.
//
// Two things are being protected here. The first is privacy: someone who is
// not in a family must never reach it. The second is the integrity of the
// book: a contributor can add to the archive but must never be able to put
// anything on a printed page without the parent accepting it.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  INVITABLE_ROLES, canApprovePrint, canComment, canContribute, canEdit,
  canEditMemory, canManageAccess, canModerate, canRead, canSeeMemory,
  eligibleForBook, statusForNewMemory, type FamilyRole,
} from "@/lib/family/roles";

const ROLES: FamilyRole[] = ["owner", "editor", "contributor"];
const OWNER = "user-owner", EDITOR = "user-editor", GRAN = "user-gran", OUTSIDER = "user-outsider";

describe("a stranger has no rights at all", () => {
  it("cannot read, contribute, moderate or manage", () => {
    for (const can of [canRead, canContribute, canEdit, canModerate, canManageAccess, canComment, canApprovePrint]) {
      expect(can(null)).toBe(false);
    }
  });

  it("cannot see a memory even when it is approved", () => {
    const memory = { contributionStatus: "approved" as const, createdBy: OWNER };
    expect(canSeeMemory(null, memory, OUTSIDER)).toBe(false);
  });

  it("refuses to give a non-member a status for a new memory", () => {
    expect(() => statusForNewMemory(null)).toThrow();
  });
});

describe("everyone in the family can take part", () => {
  it("can read, add and comment, whatever their role", () => {
    for (const role of ROLES) {
      expect(canRead(role), role).toBe(true);
      expect(canContribute(role), role).toBe(true);
      expect(canComment(role), role).toBe(true);
    }
  });
});

describe("what a contributor may not do", () => {
  it("cannot approve a book for print — that is the owner's alone", () => {
    expect(canApprovePrint("contributor")).toBe(false);
    expect(canApprovePrint("editor")).toBe(false);
    expect(canApprovePrint("owner")).toBe(true);
  });

  it("cannot invite people or change anyone's access", () => {
    expect(canManageAccess("contributor")).toBe(false);
    expect(canManageAccess("editor")).toBe(false);
    expect(canManageAccess("owner")).toBe(true);
  });

  it("cannot review their own contribution into the book", () => {
    expect(canModerate("contributor")).toBe(false);
  });

  it("cannot edit the book itself", () => {
    expect(canEdit("contributor")).toBe(false);
  });
});

describe("moderation decides what waits", () => {
  it("holds a contributor's addition, and lets a parent's through", () => {
    expect(statusForNewMemory("contributor")).toBe("pending");
    expect(statusForNewMemory("editor")).toBe("approved");
    expect(statusForNewMemory("owner")).toBe("approved");
  });

  it("never offers ownership by invitation", () => {
    expect(INVITABLE_ROLES).not.toContain("owner");
  });
});

describe("who can see something still waiting", () => {
  const pending = { contributionStatus: "pending" as const, createdBy: GRAN };

  it("shows it to whoever added it", () => {
    expect(canSeeMemory("contributor", pending, GRAN)).toBe(true);
  });

  it("shows it to the people who will decide on it", () => {
    expect(canSeeMemory("owner", pending, OWNER)).toBe(true);
    expect(canSeeMemory("editor", pending, EDITOR)).toBe(true);
  });

  it("hides it from another contributor", () => {
    // A half-considered contribution should not appear in the family's
    // archive before anyone has accepted it.
    expect(canSeeMemory("contributor", pending, "user-other-gran")).toBe(false);
  });

  it("shows approved content to everyone in the family", () => {
    const approved = { contributionStatus: "approved" as const, createdBy: OWNER };
    for (const role of ROLES) expect(canSeeMemory(role, approved, GRAN), role).toBe(true);
  });

  it("hides a declined contribution from everyone but its author and the moderators", () => {
    const declined = { contributionStatus: "declined" as const, createdBy: GRAN };
    expect(canSeeMemory("contributor", declined, "user-other-gran")).toBe(false);
    expect(canSeeMemory("contributor", declined, GRAN)).toBe(true);
    expect(canSeeMemory("owner", declined, OWNER)).toBe(true);
  });
});

describe("correcting what you added", () => {
  it("lets a contributor fix their own while it is still waiting", () => {
    const mine = { contributionStatus: "pending" as const, createdBy: GRAN };
    expect(canEditMemory("contributor", mine, GRAN)).toBe(true);
  });

  it("stops them editing it once it has been accepted into the archive", () => {
    const accepted = { contributionStatus: "approved" as const, createdBy: GRAN };
    expect(canEditMemory("contributor", accepted, GRAN)).toBe(false);
  });

  it("never lets a contributor touch someone else's", () => {
    const theirs = { contributionStatus: "pending" as const, createdBy: OWNER };
    expect(canEditMemory("contributor", theirs, GRAN)).toBe(false);
  });

  it("lets the parent edit anything in the archive", () => {
    const theirs = { contributionStatus: "approved" as const, createdBy: GRAN };
    expect(canEditMemory("owner", theirs, OWNER)).toBe(true);
    expect(canEditMemory("editor", theirs, EDITOR)).toBe(true);
  });
});

describe("keeping something to yourself", () => {
  const mine = {
    contributionStatus: "approved" as const,
    createdBy: GRAN,
    visibility: "private" as const,
  };

  it("shows a private memory to whoever wrote it", () => {
    expect(canSeeMemory("contributor", mine, GRAN)).toBe(true);
  });

  it("hides it from everyone else in the family", () => {
    expect(canSeeMemory("contributor", mine, "user-other")).toBe(false);
    expect(canSeeMemory("editor", mine, EDITOR)).toBe(false);
  });

  it("hides it from the owner too", () => {
    // The account holder being able to read through it would make the word
    // meaningless. Private has to mean private or it should not be offered.
    expect(canSeeMemory("owner", mine, OWNER)).toBe(false);
  });

  it("beats approval — approved does not mean shared", () => {
    expect(mine.contributionStatus).toBe("approved");
    expect(canSeeMemory("owner", mine, OWNER)).toBe(false);
  });

  it("lets nobody but the author edit it", () => {
    expect(canEditMemory("owner", mine, OWNER)).toBe(false);
    expect(canEditMemory("editor", mine, EDITOR)).toBe(false);
    expect(canEditMemory("contributor", mine, GRAN)).toBe(true);
  });

  it("treats a memory with no visibility set as shared, so old archives still work", () => {
    const legacy = { contributionStatus: "approved" as const, createdBy: OWNER };
    expect(canSeeMemory("contributor", legacy, GRAN)).toBe(true);
  });
});

describe("nothing unapproved reaches the printed page", () => {
  const archive = [
    { id: "a", contribution_status: "approved" as const },
    { id: "b", contribution_status: "pending" as const },
    { id: "c", contribution_status: "declined" as const },
    { id: "d", contribution_status: "approved" as const },
  ];

  it("passes only what the parent accepted", () => {
    expect(eligibleForBook(archive).map((m) => m.id)).toEqual(["a", "d"]);
  });

  it("treats a memory with no status as approved, so old archives still print", () => {
    expect(eligibleForBook([{ id: "old" } as any])).toHaveLength(1);
  });

  it("drops everything when nothing has been reviewed yet", () => {
    const allPending = archive.map((m) => ({ ...m, contribution_status: "pending" as const }));
    expect(eligibleForBook(allPending)).toHaveLength(0);
  });

  it("never prints a private note", () => {
    // The book is shared and extra copies go to grandparents, so a private
    // note on page forty would be the worst failure this feature could have.
    const withPrivate = [
      { id: "shared", contribution_status: "approved" as const, visibility: "family" as const },
      { id: "secret", contribution_status: "approved" as const, visibility: "private" as const },
    ];
    expect(eligibleForBook(withPrivate).map((m) => m.id)).toEqual(["shared"]);
  });

  it("filters at the source the book is actually built from", () => {
    // The generation jobs run as the service role and so are not covered by
    // RLS. loadMemories() is the only thing between a pending contribution
    // and a printed page, so the filter is asserted against the real file
    // rather than trusted to stay there.
    const handlers = readFileSync(
      new URL("../src/lib/jobs/handlers.ts", import.meta.url), "utf8"
    );
    const loader = handlers.slice(
      handlers.indexOf("async function loadMemories"),
      handlers.indexOf("// ------------------------------------------------------------- handlers")
    );
    // The filter moved into loadStoryMemories when memories stopped
    // belonging to a subject, so the assertion follows it rather than
    // relaxing. The gate is still one gate; it is just no longer written out
    // at each of the places that needs it.
    expect(loader).toContain("approvedOnly: true");
    expect(loader).toContain("familyVisibleOnly: true");

    const scope = readFileSync(
      new URL("../src/lib/memories/scope.ts", import.meta.url), "utf8"
    );
    expect(scope).toContain('options.approvedOnly) scoped = scoped.eq("contribution_status", "approved")');
    expect(scope).toContain('options.approvedOnly) q = q.eq("contribution_status", "approved")');
    expect(scope).toContain('options.familyVisibleOnly) q = q.eq("visibility", "family")');
  });
});
