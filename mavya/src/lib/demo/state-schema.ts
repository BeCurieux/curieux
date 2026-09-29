import { z } from "zod";

// What a visitor has done in the demo: reported an absence, booked a
// make-up, taken attendance, updated a skill, offered a spot. Stored in a
// cookie, so it is untrusted input and always parsed through this schema.
// Anything unreadable falls back to a fresh demo rather than an error.

const skillStatus = z.enum(["not_started", "developing", "achieved"]);

export const demoStateSchema = z.object({
  absence: z
    .object({ reason: z.string().max(200) })
    .nullable()
    .default(null),
  makeupClassId: z.string().max(40).nullable().default(null),
  attendance: z.record(z.string().max(40), z.enum(["present", "absent"])).default({}),
  skills: z.record(z.string().max(40), skillStatus).default({}),
  offered: z.array(z.string().max(40)).max(20).default([]),
});

export type DemoState = z.infer<typeof demoStateSchema>;

export const EMPTY_STATE: DemoState = demoStateSchema.parse({});

export function parseDemoState(raw: string | undefined): DemoState {
  if (!raw) return EMPTY_STATE;
  try {
    const result = demoStateSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}
