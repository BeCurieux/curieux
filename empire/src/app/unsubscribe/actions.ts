"use server";

import { track } from "@/lib/analytics/track";
import { systemRepo } from "@/lib/data";

export async function unsubscribe(token: string): Promise<{ done: boolean }> {
  if (!/^[\w-]{32,128}$/.test(token)) return { done: false };
  const done = await systemRepo().unsubscribeEmail(token);
  if (done) await track("email_unsubscribed", null, {});
  return { done };
}
