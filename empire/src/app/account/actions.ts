"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { serverEnv } from "@/env";
import { requireUser } from "@/lib/auth/session";
import { LOCAL_SESSION_COOKIE } from "@/lib/auth/local-session";
import { billingDeps } from "@/lib/billing";
import { claimByEmail, claimLicense } from "@/lib/billing/service";
import { systemRepo } from "@/lib/data";
import { deleteAllUploads } from "@/lib/uploads/store";
import { track } from "@/lib/analytics/track";
import { userClient } from "@/lib/supabase/clients";
import type { FormState } from "@/app/studio/actions";

export async function claimLicenseAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const key = String(form.get("licenseKey") ?? "").trim();
  if (!key) return { message: "Paste the licence key from your Gumroad receipt." };
  try {
    const result = await claimLicense(billingDeps(), user.id, key);
    if (!result.ok) return { message: result.message };
    if (result.event === "created")
      await track("purchase_verified", user.id, { product_type: result.purchase.productType });
  } catch (error) {
    console.error("claim licence", error);
    return { message: "We couldn't reach Gumroad just now. Try again in a minute." };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Verified — your Launch Pack is unlocked. Thank you!" };
}

export async function findPurchasesAction(_prev: FormState, _form: FormData): Promise<FormState> {
  const user = await requireUser();
  const claimed = await claimByEmail(billingDeps(), user.id, user.email);
  revalidatePath("/", "layout");
  return {
    ok: true,
    message:
      claimed.length > 0
        ? `Found ${claimed.length} purchase${claimed.length === 1 ? "" : "s"} for ${user.email}.`
        : `No purchases found for ${user.email} yet. Pings can take a minute — or use your licence key below.`,
  };
}

/** Local backend only: give yourself a product to try the paid parts. */
export async function devGrantAction(
  productType: "launch_pack" | "library:income-fit-test",
): Promise<void> {
  if (serverEnv().EMPIRE_BACKEND !== "local") return;
  if (productType !== "launch_pack" && productType !== "library:income-fit-test") return;
  const user = await requireUser();
  const repo = systemRepo();
  const { purchase } = await repo.upsertPurchase({
    provider: "gumroad",
    externalPurchaseId: `local-${randomUUID()}`,
    productType,
    email: user.email,
    status: "paid",
    amountCents: 0,
    currency: "USD",
    licenseKey: null,
    purchasedAt: new Date().toISOString(),
  });
  await repo.syncEntitlement(await repo.attachPurchase(purchase.id, user.id));
  revalidatePath("/", "layout");
}

export async function deleteAccountAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (
    String(form.get("confirm") ?? "")
      .trim()
      .toUpperCase() !== "DELETE"
  ) {
    return { message: "Type DELETE to confirm." };
  }
  await deleteAllUploads(user.id);
  await systemRepo().deleteUser(user.id);
  if (serverEnv().EMPIRE_BACKEND === "local") (await cookies()).delete(LOCAL_SESSION_COOKIE);
  else await (await userClient()).auth.signOut();
  redirect("/?deleted=1");
}
