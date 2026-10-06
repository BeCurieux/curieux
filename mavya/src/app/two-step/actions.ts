"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

// Two-step sign-in for owners (docs/M6_MIGRATION_PILOT.md, M6d), with
// Supabase Auth's authenticator-app codes. Passing it raises this session to
// the level the database asks of owners.

export type TwoStepState = {
  error?: string;
  // While setting up: the new authenticator to confirm.
  factorId?: string;
  qrCode?: string;
  secret?: string;
};

const code = z.string().regex(/^\d{6}$/);

// Starts setting up an authenticator: anything half set up before is
// dropped, and a fresh one is made for the owner to scan.
export async function startSetup(_: TwoStepState): Promise<TwoStepState> {
  await requireViewer();
  const supabase = await createClient();
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  if (factors.totp.length > 0)
    return { error: "You already have an authenticator. Enter its code." };
  for (const f of factors.all.filter((f) => f.status === "unverified")) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Ovyko",
    friendlyName: "Authenticator app",
  });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

// Checks a code: for the authenticator being set up, or the one already set
// up. On success the session is raised and the owner goes on.
export async function verifyCode(_: TwoStepState, formData: FormData): Promise<TwoStepState> {
  await requireViewer();
  const parsed = code.safeParse(String(formData.get("code") ?? "").replace(/\s/g, ""));
  if (!parsed.success) return { error: "Enter the 6-digit code from your app." };
  const supabase = await createClient();
  // The one being set up (named by the form), else the one already set up.
  // Either way it must be one of this person's own.
  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
  if (listError) throw listError;
  const named = String(formData.get("factor") ?? "");
  const factorId = named
    ? factors.all.find((f) => f.id === named && f.factor_type === "totp")?.id
    : factors.totp[0]?.id;
  if (!factorId) return { error: "Set up your authenticator first." };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: parsed.data });
  if (error) {
    return {
      error:
        error.status === 429
          ? "Too many tries. Wait a few minutes, then try again."
          : "That code didn't work. Check your app and try the newest code.",
    };
  }
  // People who run Ovyko but don't own a school go to Ovyko's totals.
  const viewer = await requireViewer();
  const { data: platform } = await supabase.rpc("am_platform_admin");
  redirect(platform && !viewer.shells.includes("business") ? "/platform" : "/business");
}
