import "server-only";

// Authentication (brief §27).
//
// The rule that shapes this file: **do not require signup before creation.**
// A visitor can describe a widget, generate it, edit it and preview it while
// completely anonymous. Only Publish asks who they are — and when they do
// sign up, the widget they already made comes with them.
//
// That is implemented with two cookies' worth of idea and one: an author
// session always exists, it just might belong to a user row with no email
// yet. Signing up fills that row in (or moves the work onto an existing
// account). Nothing in the product has to know which kind of author it has.

import { cookies } from "next/headers";
import { getStore } from "@/lib/db/store";
import type { User } from "@/lib/db/types";
import { emailProblem, hashPassword, passwordProblem, verifyPassword } from "./password";

export { emailProblem, hashPassword, passwordProblem, verifyPassword };

export const SESSION_COOKIE = "qw_author";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 365,
};

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

/** The signed-in-or-anonymous author, if a session cookie resolves. */
export async function currentUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const store = getStore();
  const session = await store.getSession(token);
  if (!session) return null;
  return store.getUser(session.userId);
}

/** True when the author has actually signed up (as opposed to anonymous). */
export function isRegistered(user: User | null): user is User {
  return Boolean(user?.email);
}

/**
 * The author of whatever is about to be created — inventing an anonymous one
 * if needed. This is what lets the homepage's "Build it" button work for
 * someone who has never seen the product before.
 */
export async function ensureAuthor(): Promise<User> {
  const existing = await currentUser();
  if (existing) return existing;

  const store = getStore();
  const user = await store.createUser({});
  const session = await store.createSession(user.id);
  cookies().set(SESSION_COOKIE, session.token, COOKIE_OPTIONS);
  return user;
}

/** For pages that genuinely need an account. */
export async function requireRegisteredUser(): Promise<User> {
  const user = await currentUser();
  if (!isRegistered(user)) throw new Error("not signed in");
  return user;
}

async function startSession(userId: string): Promise<void> {
  const session = await getStore().createSession(userId);
  cookies().set(SESSION_COOKIE, session.token, COOKIE_OPTIONS);
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  /** How many anonymous widgets came across with them (§27). */
  claimed?: number;
}

/**
 * Create an account, keeping any work done while anonymous.
 *
 * The anonymous user row is upgraded in place when possible, so ids stay
 * stable and there is nothing to migrate. If the email already exists we sign
 * them in and move the widgets over instead — someone coming back to publish
 * from a second device should not be told "email taken" and lose their work.
 */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  const store = getStore();
  const emailIssue = emailProblem(email);
  if (emailIssue) return { ok: false, error: emailIssue };
  const passwordIssue = passwordProblem(password);
  if (passwordIssue) return { ok: false, error: passwordIssue };

  const normalised = email.trim().toLowerCase();
  const anonymous = await currentUser();
  const existing = await store.findUserByEmail(normalised);

  if (existing) {
    if (!(await verifyPassword(password, existing.passwordHash))) {
      return { ok: false, error: "That email already has an account. Try signing in." };
    }
    const claimed =
      anonymous && !anonymous.email ? await store.claimWidgets(anonymous.id, existing.id) : 0;
    await startSession(existing.id);
    return { ok: true, claimed };
  }

  const passwordHash = await hashPassword(password);
  const user = await store.createUser({ email: normalised, passwordHash });
  const claimed = anonymous && !anonymous.email ? await store.claimWidgets(anonymous.id, user.id) : 0;
  await startSession(user.id);
  return { ok: true, claimed };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const store = getStore();
  const user = await store.findUserByEmail(email.trim().toLowerCase());
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    // Deliberately the same message for both cases — don't confirm which
    // emails have accounts.
    return { ok: false, error: "That email and password don't match." };
  }

  const anonymous = await currentUser();
  const claimed = anonymous && !anonymous.email ? await store.claimWidgets(anonymous.id, user.id) : 0;
  await startSession(user.id);
  return { ok: true, claimed };
}

export async function signOut(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await getStore().deleteSession(token);
  cookies().delete(SESSION_COOKIE);
}

/* ------------------------------------------------------------------ */
/* Account                                                             */
/* ------------------------------------------------------------------ */

/**
 * Change the password, having proved you know the old one.
 *
 * The account is whoever the session cookie resolves to — never an id from
 * the caller, so there is no request shape that changes somebody else's
 * password.
 *
 * Every other session is dropped. If the reason you are here is that someone
 * else had your password, leaving their session alive would make the change
 * pointless.
 */
export async function changePassword(current: string, next: string): Promise<AuthResult> {
  const user = await currentUser();
  if (!isRegistered(user)) return { ok: false, error: "You need to be signed in." };

  if (!(await verifyPassword(current, user.passwordHash))) {
    return { ok: false, error: "That current password isn't right." };
  }

  const problem = passwordProblem(next);
  if (problem) return { ok: false, error: problem };
  if (await verifyPassword(next, user.passwordHash)) {
    return { ok: false, error: "That's the password you already have." };
  }

  const store = getStore();
  await store.setUserPassword(user.id, await hashPassword(next));
  await store.deleteSessionsForUser(user.id, cookies().get(SESSION_COOKIE)?.value);
  return { ok: true };
}

/**
 * Delete the account and everything in it.
 *
 * Asks for the password rather than a typed confirmation phrase: it proves
 * the person at the keyboard is the account holder, which a phrase copied
 * off the screen does not. Irreversible, and the copy says so before this
 * ever runs.
 */
export async function deleteAccount(password: string): Promise<AuthResult> {
  const user = await currentUser();
  if (!isRegistered(user)) return { ok: false, error: "You need to be signed in." };

  if (!(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "That password isn't right." };
  }

  await getStore().deleteUser(user.id);
  cookies().delete(SESSION_COOKIE);
  return { ok: true };
}

/** Ownership check for every widget mutation. */
export async function ownsWidget(userId: string, widgetId: string): Promise<boolean> {
  const widget = await getStore().getWidget(widgetId);
  return widget?.ownerId === userId;
}
