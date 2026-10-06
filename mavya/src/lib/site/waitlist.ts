"use server";

import { z } from "zod";
import { explain } from "@/lib/domain/db";
import { fieldErrors, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// Joining the founding-schools waitlist from the public website
// (docs/WAITLIST_PAGE.md). The database checks everything again.

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(100),
  school: z.string().trim().min(1, "Enter your school's name.").max(120),
  suburb: z.string().trim().min(1, "Enter your suburb.").max(80),
  email: z.email("Check your email address.").max(200),
  phone: z.string().trim().max(30),
  swimmers: z.enum(["", "under_200", "200_500", "500_1000", "over_1000"]),
  currentSystem: z.enum(["", "iclasspro", "simplyswim", "class_manager", "spreadsheets", "other"]),
  nextBreak: z.string().trim().max(80),
  consent: z.literal("yes", { error: "Tick the box so we can email you about founding places." }),
});

export async function joinWaitlist(_: FormState, form: FormData): Promise<FormState> {
  // A field people can't see: anything in it is a bot. Say it worked.
  if (String(form.get("website") ?? "") !== "") return { ok: "joined" };
  const get = (k: string) => String(form.get(k) ?? "");
  const parsed = schema.safeParse({
    name: get("name"),
    school: get("school"),
    suburb: get("suburb"),
    email: get("email").trim(),
    phone: get("phone"),
    swimmers: get("swimmers"),
    currentSystem: get("currentSystem"),
    nextBreak: get("nextBreak"),
    consent: get("consent"),
  });
  if (!parsed.success) return fieldErrors(parsed.error);
  const d = parsed.data;
  const db = await createClient();
  const { error } = await db.rpc("join_waitlist", {
    p_name: d.name,
    p_school: d.school,
    p_suburb: d.suburb,
    p_email: d.email,
    p_phone: d.phone,
    p_swimmers: d.swimmers,
    p_current_system: d.currentSystem,
    p_next_break: d.nextBreak,
    p_consent: true,
  });
  if (error) return { error: explain(error).message };
  return { ok: "joined" };
}
