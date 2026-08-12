"use server";

// Server actions.
//
// Every mutation starts the same way: work out who is acting, and check they
// own the thing. `ensureAuthor()` will invent an anonymous account rather than
// bounce someone to a signup form (§27) — the only action that insists on a
// real account is publishing.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  changePassword,
  currentUser,
  deleteAccount,
  ensureAuthor,
  isRegistered,
  signIn,
  signOut,
  signUp,
} from "@/lib/auth/session";
import { getStore } from "@/lib/db/store";
import { getAIProvider, MAX_PROMPT_LENGTH } from "@/lib/ai/provider";
import { templateBySlug } from "@/lib/templates/catalogue";
import { blankWidget } from "@/lib/widget/defaults";
import { widgetSchemaSchema, widgetTypeSchema, type WidgetDocument } from "@/lib/widget/schema";
import { createWidgetFor, isLimitError, snapshot } from "@/lib/widgets/service";

export interface ActionResult {
  ok: boolean;
  error?: string;
  widgetId?: string;
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Creating                                                            */
/* ------------------------------------------------------------------ */

export async function createFromPrompt(prompt: string, preferredType?: string): Promise<ActionResult> {
  const text = prompt.trim().slice(0, MAX_PROMPT_LENGTH);
  if (text.length < 3) {
    return { ok: false, error: "Tell us a little about what you want to build." };
  }

  const author = await ensureAuthor();
  const type = widgetTypeSchema.safeParse(preferredType);

  const generated = await getAIProvider().generateWidget(text, {
    preferredType: type.success ? type.data : undefined,
  });

  const created = await createWidgetFor(author.id, author.plan, generated.document);
  if (isLimitError(created)) return { ok: false, error: created.message };

  revalidatePath("/dashboard");
  return { ok: true, widgetId: created.id, note: generated.note };
}

export async function createFromTemplate(slug: string): Promise<ActionResult> {
  const template = templateBySlug(slug);
  if (!template) return { ok: false, error: "We couldn't find that template." };

  const author = await ensureAuthor();
  const created = await createWidgetFor(author.id, author.plan, structuredClone(template.document));
  if (isLimitError(created)) return { ok: false, error: created.message };

  revalidatePath("/dashboard");
  return { ok: true, widgetId: created.id };
}

export async function createBlank(type: string): Promise<ActionResult> {
  const parsed = widgetTypeSchema.safeParse(type);
  if (!parsed.success) return { ok: false, error: "Pick calculator, estimator or quiz." };

  const author = await ensureAuthor();
  const created = await createWidgetFor(author.id, author.plan, blankWidget(parsed.data));
  if (isLimitError(created)) return { ok: false, error: created.message };

  revalidatePath("/dashboard");
  return { ok: true, widgetId: created.id };
}

/** The "Duplicate this widget" half of the growth loop (§22). */
export async function duplicateWidget(id: string): Promise<ActionResult> {
  const store = getStore();
  const source = await store.getWidget(id);
  if (!source) return { ok: false, error: "We couldn't find that widget." };

  // Only a published widget can be copied by someone who doesn't own it —
  // that's the loop. A draft is private.
  const author = await ensureAuthor();
  const document = source.ownerId === author.id ? source.draft : source.published;
  if (!document) return { ok: false, error: "That widget isn't published." };

  const copy: WidgetDocument = { ...structuredClone(document), name: `${document.name} copy` };
  const created = await createWidgetFor(author.id, author.plan, copy);
  if (isLimitError(created)) return { ok: false, error: created.message };

  revalidatePath("/dashboard");
  return { ok: true, widgetId: created.id };
}

/* ------------------------------------------------------------------ */
/* Editing                                                             */
/* ------------------------------------------------------------------ */

/** Autosave (§33). Called on a debounce from the builder. */
export async function saveWidget(id: string, document: unknown): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Your session expired. Refresh and try again." };

  const store = getStore();
  const widget = await store.getWidget(id);
  if (!widget || widget.ownerId !== user.id) return { ok: false, error: "That isn't your widget." };

  const parsed = widgetSchemaSchema.safeParse(document);
  if (!parsed.success) {
    // The builder shouldn't be able to produce this; if it does, the draft on
    // disk stays as it was rather than becoming unloadable.
    return { ok: false, error: "That change couldn't be saved." };
  }

  await store.updateWidgetDraft(id, parsed.data, parsed.data.name);
  return { ok: true };
}

export async function publishWidget(id: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Your session expired. Refresh and try again." };

  const store = getStore();
  const widget = await store.getWidget(id);
  if (!widget || widget.ownerId !== user.id) return { ok: false, error: "That isn't your widget." };

  // §27: this is the one moment we ask who they are.
  if (!isRegistered(user)) return { ok: false, error: "signup-required" };

  await snapshot(widget, widget.status === "published" ? "Before republish" : "First publish");
  await store.publishWidget(id);

  revalidatePath("/dashboard");
  revalidatePath(`/w/${widget.slug}`);
  return { ok: true };
}

export async function unpublishWidget(id: string): Promise<ActionResult> {
  const user = await currentUser();
  const store = getStore();
  const widget = await store.getWidget(id);
  if (!user || !widget || widget.ownerId !== user.id) return { ok: false, error: "That isn't your widget." };

  await store.unpublishWidget(id);
  revalidatePath("/dashboard");
  revalidatePath(`/w/${widget.slug}`);
  return { ok: true };
}

export async function deleteWidget(id: string): Promise<ActionResult> {
  const user = await currentUser();
  const store = getStore();
  const widget = await store.getWidget(id);
  if (!user || !widget || widget.ownerId !== user.id) return { ok: false, error: "That isn't your widget." };

  await store.deleteWidget(id);
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

const credentials = z.object({
  email: z.string().min(3).max(200),
  password: z.string().min(1).max(200),
});

export async function signUpAction(formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: "Fill in both fields." };

  const result = await signUp(parsed.data.email, parsed.data.password);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function signInAction(formData: FormData): Promise<ActionResult> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, error: "Fill in both fields." };

  const result = await signIn(parsed.data.email, parsed.data.password);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function signOutAction(): Promise<void> {
  await signOut();
  revalidatePath("/");
}

/* ---- Account ------------------------------------------------------ */

// Both of these take the password out of a FormData rather than a typed
// argument, so it never becomes part of a React server-action payload that
// might be logged. Neither takes a user id: the account is whoever the
// session cookie resolves to, checked in lib/auth/session.ts.

export async function changePasswordAction(formData: FormData): Promise<ActionResult> {
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  if (!current || !next) return { ok: false, error: "Fill in both fields." };

  const result = await changePassword(current, next);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

export async function deleteAccountAction(formData: FormData): Promise<ActionResult> {
  const password = String(formData.get("password") ?? "");
  if (!password) return { ok: false, error: "Enter your password to confirm." };

  const result = await deleteAccount(password);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/");
  return { ok: true };
}
