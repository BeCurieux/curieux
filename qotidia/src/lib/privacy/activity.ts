// The activity log.
//
// Written for the family to read, not for us. That is the whole point: a
// parent who can see "Grandpa opened Florence's 2027 album on Tuesday" does
// not need to be told the product is private — they can watch it being
// private.
//
// Two rules keep it honest.
//
//   It records people, not content. "Added a photograph", never which one.
//   A log that quoted the archive would be a second copy of the archive.
//
//   It is never a reason to fail. Logging is best-effort; an archive that
//   refuses an upload because the audit trail is down is worse, not safer.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityKind =
  | "viewed_archive"
  | "viewed_book"
  | "downloaded_book"
  | "exported_archive"
  | "added_memory"
  | "approved_contribution"
  | "declined_contribution"
  | "invited_member"
  | "member_joined"
  | "removed_member"
  | "changed_role"
  | "ordered_book"
  | "cancelled_renewal"
  | "support_access_granted"
  | "support_access_used"
  | "upload_refused"
  | "inbox_address_rotated"
  | "named_keeper"
  | "removed_keeper"
  | "succession_claimed"
  | "succession_refused"
  | "succession_completed"
  | "shared_story"
  | "revoked_share"
  | "story_contribution";

/** How each event reads to a family. Second person for your own actions. */
export const ACTIVITY_PHRASE: Record<ActivityKind, string> = {
  viewed_archive: "looked through the archive",
  viewed_book: "read the book",
  downloaded_book: "downloaded the book",
  exported_archive: "downloaded a copy of everything",
  added_memory: "added something",
  approved_contribution: "kept a contribution",
  declined_contribution: "left a contribution out",
  invited_member: "invited someone",
  member_joined: "joined",
  removed_member: "removed someone's access",
  changed_role: "changed what someone can do",
  ordered_book: "ordered the book",
  cancelled_renewal: "stopped a scheduled printing",
  support_access_granted: "gave our support team temporary access",
  support_access_used: "— our support team looked, with your permission",
  inbox_address_rotated: "changed the private address things can be sent to",
  upload_refused: "— a file was refused before it was stored",
  named_keeper: "named who would keep this archive",
  removed_keeper: "changed who would keep this archive",
  // Written in the third person and stated plainly. Whoever reads this line
  // later needs to know exactly what was attempted and by whom, and a
  // softened phrase would be the wrong kindness.
  succession_claimed: "— asked to take over this archive",
  succession_refused: "— a request to take over this archive was stopped",
  succession_completed: "— this archive changed hands",
  shared_story: "sent a story to someone",
  revoked_share: "stopped a link that had been sent",
  // Third person, and it names them: whoever this was has no account, so
  // the label is a name they typed rather than a member of the family.
  story_contribution: "— added something to a story they were sent",
};

/**
 * Events worth telling a family about. Deliberately short: a log of
 * everything is a log nobody reads, and the ones that matter are the ones
 * involving another person or a copy leaving.
 */
export interface ActivityInput {
  familyId: string;
  subjectId?: string | null;
  actorId: string | null;
  actorLabel: string;
  kind: ActivityKind;
  /** Never archive content — a page number or a name, at most. */
  detail?: string | null;
}

export async function record(db: SupabaseClient, input: ActivityInput): Promise<void> {
  try {
    await db.from("activity_log").insert({
      family_id: input.familyId,
      subject_id: input.subjectId ?? null,
      actor_id: input.actorId,
      actor_label: input.actorLabel,
      kind: input.kind,
      detail: input.detail ?? null,
    });
  } catch (err) {
    // Never fail the action being logged.
    console.error("activity log write failed:", (err as Error).message);
  }
}

/**
 * Whether a detail string is safe to log — the same discipline the email
 * layer applies, for the same reason. The log is readable by everyone in the
 * family, so a detail carrying a child's words would quietly re-publish the
 * archive to people a contribution had not yet been approved for.
 */
export function safeDetail(detail: string | null | undefined): string | null {
  if (!detail) return null;
  if (/[“"][^“”"]{3,}[”"]/.test(detail)) return null;
  return detail.length > 120 ? `${detail.slice(0, 117)}…` : detail;
}
