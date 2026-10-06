"use server";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/supabase/server-env";

// "Try it yourself" (docs/TRY_IT_YOURSELF.md): gives a visitor a throwaway
// sign-in and their own pretend swim school, then opens it. The database
// makes and fills the school, limits how many one visitor can make, and
// deletes both a day later.

const DEMO_DOMAIN = "demo.ovyko.invalid";

// One visitor, as a one-way hash of their internet address (never stored
// as it is). Without an address every request counts as a new visitor.
async function visitor(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || randomUUID();
  return createHash("sha256").update(`${address}:${serverEnv().SUPABASE_SECRET_KEY}`).digest("hex");
}

export async function tryOvyko(_: FormState, form: FormData): Promise<FormState> {
  // A field people can't see: anything in it is a bot.
  if (String(form.get("website") ?? "") !== "") return { error: "That didn't work. Try again." };

  const admin = createAdminClient();
  const email = `try-${randomUUID()}@${DEMO_DOMAIN}`;
  const password = randomBytes(24).toString("base64url");
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Alex" },
  });
  if (createError || !created.user) throw createError ?? new Error("No demo sign-in made.");

  const forget = () => admin.auth.admin.deleteUser(created.user.id);
  const { data: profile, error: profileError } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", created.user.id)
    .single();
  if (profileError || !profile) {
    await forget();
    throw profileError ?? new Error("No profile for the demo sign-in.");
  }

  const { error: schoolError } = await admin.rpc("create_demo_school", {
    p_user: profile.id,
    p_visitor: await visitor(),
  });
  if (schoolError) {
    await forget();
    if (schoolError.hint === "demo_busy") return { error: schoolError.message };
    throw schoolError;
  }

  const { error: signInError } = await (
    await createClient()
  ).auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) throw signInError;
  redirect("/business");
}
