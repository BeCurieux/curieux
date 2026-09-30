"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { LAST_SEEN_COOKIE, lastSeenCookie } from "@/lib/auth/idle";
import { DomainError } from "@/lib/domain/db";
import * as invites from "@/lib/domain/invites";
import { fieldErrors, formValues, type FormState } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Joining a family from an invite link (docs/M6_MIGRATION_PILOT.md, M6b).
// Sign-up is closed: an account is created here, by the server, only for a
// valid invite and only with the email it was made for. The database then
// checks the link again as the new person when they join.

// `name` comes back so the form keeps what was typed when it's refused.
export type JoinState = FormState & { existingAccount?: boolean; name?: string };

const code = z.string().regex(/^[0-9a-f]{64}$/);

const newAccount = z.object({
  code,
  name: z
    .string({ error: "Enter your name." })
    .min(1, "Enter your name.")
    .max(80, "That name is too long."),
  password: z
    .string({ error: "Choose a password of at least 10 characters." })
    .min(10, "Choose a password of at least 10 characters.")
    .max(72, "That password is too long."),
});

async function join(inviteCode: string): Promise<JoinState | null> {
  const db = await createClient();
  try {
    await invites.acceptInvite(db, inviteCode);
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    throw error;
  }
  (await cookies()).set(LAST_SEEN_COOKIE, String(Date.now()), lastSeenCookie);
  return null;
}

export async function joinWithNewAccount(_: JoinState, formData: FormData): Promise<JoinState> {
  const values = formValues(formData);
  const parsed = newAccount.safeParse(values);
  if (!parsed.success) return { ...fieldErrors(parsed.error), name: values.name };
  const { code: inviteCode, name, password } = parsed.data;

  const db = await createClient();
  const invite = await invites.inviteDetails(db, inviteCode);
  if (!invite || invite.status !== "pending")
    return { error: "This invite can't be used any more. Ask the school for a new one." };

  const { error: createError } = await createAdminClient().auth.admin.createUser({
    email: invite.email,
    password,
    // The school vouches for this address: the link was made for it.
    email_confirm: true,
    user_metadata: { name },
  });
  if (createError) {
    if (createError.code === "email_exists" || createError.status === 422)
      return {
        error: "You already have an Ovyko account with this email. Sign in to join.",
        existingAccount: true,
      };
    if (createError.code === "weak_password")
      return {
        error: "Choose a stronger password.",
        fieldErrors: { password: "Too easy to guess." },
      };
    throw createError;
  }

  const { error: signInError } = await db.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  if (signInError) throw signInError;

  const failed = await join(inviteCode);
  if (failed) return failed;
  redirect("/family");
}

// Someone already signed in joins the family.
export async function joinSignedIn(_: JoinState, formData: FormData): Promise<JoinState> {
  const parsed = code.safeParse(formData.get("code"));
  if (!parsed.success) return { error: "That didn't work. Try again." };
  const failed = await join(parsed.data);
  if (failed) return failed;
  redirect("/family");
}
