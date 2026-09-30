import { z } from "zod";

// What a visitor has done in the demo: offered a spot (real in M5). Stored
// in a cookie, so it is untrusted input and always parsed through this
// schema. Anything unreadable falls back to a fresh demo rather than an error.

export const demoStateSchema = z.object({
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
