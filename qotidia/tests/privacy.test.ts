// Privacy as something checkable.
//
// The activity log is readable by everyone in the family, which makes it a
// second surface the archive could leak through — a contribution still
// waiting for approval must not become visible via a log line about it.
// And the export is the promise that nobody is trapped, so its shape is
// tested: a folder tree a person can open without us.

import { describe, expect, it } from "vitest";
import { ACTIVITY_PHRASE, safeDetail, type ActivityKind } from "@/lib/privacy/activity";
import { EXPORT_NOTE, extensionFor, pathForMemory } from "@/lib/privacy/export";
import { BACKUP_EXPIRY_DAYS, DELETION_TERMS } from "@/lib/privacy/erase";

describe("the activity log records people, not content", () => {
  it("strips a quoted phrase, which is how the archive stores speech", () => {
    expect(safeDetail(`added “Bun Bun tired now”`)).toBeNull();
    expect(safeDetail(`added "I do it myself"`)).toBeNull();
  });

  it("keeps an ordinary label", () => {
    expect(safeDetail("Grandpa")).toBe("Grandpa");
    expect(safeDetail("page 14")).toBe("page 14");
  });

  it("truncates rather than logging an essay", () => {
    const long = "x".repeat(400);
    expect(safeDetail(long)!.length).toBeLessThanOrEqual(120);
  });

  it("handles nothing gracefully", () => {
    expect(safeDetail(null)).toBeNull();
    expect(safeDetail("")).toBeNull();
  });

  it("phrases every kind of event in plain words", () => {
    const kinds: ActivityKind[] = [
      "viewed_archive", "viewed_book", "downloaded_book", "exported_archive",
      "added_memory", "approved_contribution", "declined_contribution",
      "invited_member", "member_joined", "removed_member", "changed_role",
      "ordered_book", "cancelled_renewal", "support_access_granted",
      "support_access_used",
    ];
    for (const k of kinds) {
      expect(ACTIVITY_PHRASE[k], k).toBeTruthy();
      // Never a system word — a parent reads this, not an engineer.
      expect(ACTIVITY_PHRASE[k]).not.toMatch(/[A-Z_]{4,}/);
    }
  });
});

describe("the export opens without us", () => {
  const memory = (over: any = {}) => ({
    id: "abcdef123456",
    memory_date: "2027-03-14",
    created_at: "2027-03-15",
    raw_text: "Yellow boots at the museum",
    type: "photo",
    ...over,
  });

  it("files things by child, year and month, in a readable tree", () => {
    expect(pathForMemory(memory(), "jpg", "Florence"))
      .toBe("florence/2027/03-March/14-yellow-boots-at-the-museum.jpg");
  });

  it("gives an undated memory somewhere sensible rather than dropping it", () => {
    const p = pathForMemory(memory({ memory_date: null, created_at: "nonsense" }), "jpg", "Florence");
    expect(p).toContain("undated");
    expect(p.endsWith(".jpg")).toBe(true);
  });

  it("falls back to a stable name when there are no words to use", () => {
    const p = pathForMemory(memory({ raw_text: null }), "jpg", "Florence");
    expect(p).toContain("photo-abcdef");
  });

  it("does not let a name escape the folder it belongs in", () => {
    const p = pathForMemory(memory({ raw_text: "../../etc/passwd" }), "jpg", "Florence");
    expect(p).not.toContain("..");
  });

  it("keeps original formats rather than converting them", () => {
    expect(extensionFor("image/heic")).toBe("heic");
    expect(extensionFor("audio/mp4")).toBe("m4a");
    expect(extensionFor("image/jpeg")).toBe("jpg");
  });

  it("does not guess at an unknown format", () => {
    expect(extensionFor(null)).toBe("bin");
    expect(extensionFor("application/octet-stream")).toBe("bin");
  });

  it("explains itself in the archive, for someone opening it years later", () => {
    expect(EXPORT_NOTE).toMatch(/without our software/);
    expect(EXPORT_NOTE).toMatch(/belong to your family/);
  });
});

describe("deletion is described honestly", () => {
  it("does not claim backups vanish instantly", () => {
    expect(DELETION_TERMS).toContain(String(BACKUP_EXPIRY_DAYS));
    expect(DELETION_TERMS.toLowerCase()).not.toContain("instantly");
  });

  it("says plainly that it cannot be undone, including by us", () => {
    expect(DELETION_TERMS).toMatch(/not by us/);
  });

  it("says what happens to the people who were invited", () => {
    expect(DELETION_TERMS.toLowerCase()).toContain("access immediately");
  });
});
