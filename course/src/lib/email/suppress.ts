import "server-only";
import { serviceClient } from "@/lib/supabase/server";

// Marketing email on and off for one address (unsubscribe links and the
// account page). Receipts and sign-in links ignore this.

export async function suppress(email: string): Promise<boolean> {
  const { error } = await serviceClient()
    .from("email_suppressions")
    .upsert({ email: email.toLowerCase() }, { onConflict: "email", ignoreDuplicates: true });
  if (error) console.error("suppress", error.message);
  return !error;
}

export async function unsuppress(email: string): Promise<boolean> {
  const { error } = await serviceClient()
    .from("email_suppressions")
    .delete()
    .eq("email", email.toLowerCase());
  if (error) console.error("unsuppress", error.message);
  return !error;
}
