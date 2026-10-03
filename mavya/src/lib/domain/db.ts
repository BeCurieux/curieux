import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

// Every domain service takes the signed-in user's own client, so row level
// security decides what each call can see and change.
export type Db = SupabaseClient<Database>;

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

// Turns a database refusal into a sentence an owner can act on. Anything
// unexpected is rethrown as-is, so it reaches error reporting.
export function explain(error: PostgrestError): DomainError {
  switch (error.hint) {
    case "class_full":
      return new DomainError("This class is full.");
    case "class_inactive":
      return new DomainError("This class is no longer running.");
    case "capacity_below_enrolled":
    case "remove_self":
    case "lesson_not_open":
    case "not_in_class":
    case "skill_inactive":
    case "makeup_refused":
    case "already_reported":
    case "lesson_started":
    case "credit_in_use":
    case "place_taken":
    case "invalid_policy":
    case "no_open_spot":
    case "already_offered":
    case "instructor_clash":
    case "import_invalid":
    case "import_locked":
    case "invite_invalid":
    case "invite_closed":
    case "invite_wrong_email":
    case "safety_invalid":
    case "delete_unconfirmed":
    case "term_invalid":
    case "term_overlap":
    case "term_locked":
    case "term_none":
    case "term_started":
    case "term_not_asked":
    case "reply_by_invalid":
    case "move_invalid":
    case "answer_invalid":
      return new DomainError(error.message);
  }
  switch (error.code) {
    case "23505":
      return new DomainError("That already exists.");
    case "23503":
      return new DomainError("That doesn't belong to your organisation.");
    case "42501":
      return new DomainError("You don't have permission to do that.");
    case "23514":
      return new DomainError("Some of those details aren't valid.");
  }
  throw error;
}

export function must<T>(result: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (result.error) throw explain(result.error);
  if (result.data === null || result.data === undefined) throw new DomainError("Not found.");
  return result.data;
}
