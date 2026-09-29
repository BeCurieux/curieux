import "server-only";
import { cookies } from "next/headers";
import { parseDemoState, type DemoState } from "./state-schema";

export const DEMO_COOKIE = "ovyko_demo";

export async function readDemoState(): Promise<DemoState> {
  const store = await cookies();
  return parseDemoState(store.get(DEMO_COOKIE)?.value);
}

// Only callable from server actions, which are the only place cookies can
// be written.
export async function writeDemoState(state: DemoState): Promise<void> {
  const store = await cookies();
  store.set(DEMO_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearDemoState(): Promise<void> {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
}
