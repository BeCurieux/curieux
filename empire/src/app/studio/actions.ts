"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { track } from "@/lib/analytics/track";
import { tasksFor } from "@/lib/checklist/tasks";
import { isModuleKey } from "@/lib/domain/modules";
import { linesToList, profileFactsSchema, type ProfileFacts } from "@/lib/domain/profile";
import { productInputSchema } from "@/lib/domain/product";
import { runGeneration, saveVersion } from "@/lib/generation/run";
import { loadAccess } from "@/lib/generation/run";
import { studio } from "@/lib/studio/context";
import { deleteUpload, saveUpload } from "@/lib/uploads/store";

// Every mutation in the studio. Each one starts from studio(), which signs
// the request in as the customer and gives a repo scoped to her, so an id
// that isn't hers fails as "not found" before anything happens.

export interface FormState {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

function factsFrom(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? "");
  return profileFactsSchema.safeParse({
    brandName: get("brandName"),
    websiteUrl: get("websiteUrl"),
    category: get("category"),
    audience: get("audience"),
    productsSummary: get("productsSummary"),
    personality: get("personality"),
    visualStyle: get("visualStyle"),
    colours: get("colours"),
    market: get("market"),
    currency: get("currency"),
    goal: get("goal"),
    stage: get("stage"),
    fulfilment: get("fulfilment"),
    verifiedClaims: linesToList(get("verifiedClaims")),
    prohibitedClaims: linesToList(get("prohibitedClaims")),
  });
}

export async function createProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { repo } = await studio();
  const parsed = factsFrom(form);
  if (!parsed.success)
    return { errors: fieldErrors(parsed.error), message: "A few answers need another look." };
  const [{ access }, existing] = await Promise.all([loadAccess(repo), repo.listProfiles()]);
  if (existing.length >= access.profiles) {
    return {
      message:
        access.plan === "free"
          ? "The free studio has room for one business. The Launch Pack covers one business per pack."
          : "You've used the businesses your packs include. Each extra Launch Pack adds one.",
    };
  }
  const profile = await repo.createProfile(parsed.data);
  await repo.ensureTasks(
    profile.id,
    tasksFor(profile).map((t) => ({
      taskKey: t.key,
      category: t.category,
      label: t.label,
      status: "not_started" as const,
    })),
  );
  await track("profile_completed", repo.userId, { plan: access.plan });
  redirect(`/studio/${profile.id}/brand?welcome=1`);
}

export async function updateProfileAction(
  profileId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { repo } = await studio();
  const profile = await repo.getProfile(profileId);
  if (!profile) return { message: "We couldn't find that business." };
  const parsed = factsFrom(form);
  if (!parsed.success)
    return { errors: fieldErrors(parsed.error), message: "A few answers need another look." };
  await repo.updateProfile(
    profileId,
    { facts: parsed.data as ProfileFacts },
    "Business details edited",
  );
  // A change to what she sells changes which tasks apply; add any new ones.
  await repo.ensureTasks(
    profileId,
    tasksFor(parsed.data).map((t) => ({
      taskKey: t.key,
      category: t.category,
      label: t.label,
      status: "not_started" as const,
    })),
  );
  revalidatePath(`/studio/${profileId}`, "layout");
  return {
    ok: true,
    message: "Saved. Your existing assets are untouched — regenerate any you'd like refreshed.",
  };
}

export async function uploadLogoAction(
  profileId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { repo, user } = await studio();
  const profile = await repo.getProfile(profileId);
  if (!profile) return { message: "We couldn't find that business." };
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { message: "Choose an image first." };
  const saved = await saveUpload(user.id, file);
  if (!saved.ok) return { message: saved.message };
  if (profile.logoPath) await deleteUpload(user.id, profile.logoPath);
  await repo.updateProfile(profileId, { logoPath: saved.path }, "Logo uploaded");
  revalidatePath(`/studio/${profileId}`, "layout");
  return { ok: true, message: "Logo saved." };
}

export interface GenerateResult {
  ok: boolean;
  message?: string;
  reason?: string;
}

export async function generateAction(input: {
  profileId: string;
  module: string;
  productId?: string | null;
  section?: string | null;
}): Promise<GenerateResult> {
  const { repo } = await studio();
  if (!isModuleKey(input.module)) return { ok: false, message: "Unknown module." };
  const result = await runGeneration({
    repo,
    profileId: input.profileId,
    module: input.module,
    productId: input.productId ?? null,
    section: typeof input.section === "string" ? input.section.slice(0, 60) : null,
  });
  revalidatePath(`/studio/${input.profileId}`, "layout");
  return result.ok ? { ok: true } : { ok: false, message: result.message, reason: result.reason };
}

export async function saveEditAction(
  generationId: string,
  output: unknown,
): Promise<GenerateResult & { issues?: string[] }> {
  const { repo } = await studio();
  const result = await saveVersion(repo, generationId, output, "edit");
  if (!result.ok) return { ok: false, message: result.message, issues: result.issues };
  revalidatePath(`/studio/${result.generation.profileId}`, "layout");
  return { ok: true, message: `Saved as version ${result.generation.version}.` };
}

export async function restoreAction(generationId: string): Promise<GenerateResult> {
  const { repo } = await studio();
  const base = await repo.getGeneration(generationId);
  if (!base?.output) return { ok: false, message: "We couldn't find that version." };
  const result = await saveVersion(repo, generationId, base.output, "restore");
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath(`/studio/${result.generation.profileId}`, "layout");
  return {
    ok: true,
    message: `Restored version ${base.version} as version ${result.generation.version}.`,
  };
}

function productFrom(form: FormData) {
  const get = (key: string) => String(form.get(key) ?? "");
  return productInputSchema.safeParse({
    name: get("name"),
    category: get("category"),
    materials: get("materials"),
    dimensions: get("dimensions"),
    colourOptions: get("colourOptions"),
    benefits: get("benefits"),
    intendedUse: get("intendedUse"),
    customerProblem: get("customerProblem"),
    price: get("price").trim(),
    careInstructions: get("careInstructions"),
    shippingInfo: get("shippingInfo"),
    verifiedClaims: linesToList(get("verifiedClaims")),
    imageNotes: get("imageNotes"),
  });
}

export async function createProductAction(
  profileId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { repo } = await studio();
  const parsed = productFrom(form);
  if (!parsed.success)
    return { errors: fieldErrors(parsed.error), message: "A few details need another look." };
  const [{ access }, products] = await Promise.all([
    loadAccess(repo),
    repo.listProducts(profileId),
  ]);
  if (products.length >= access.productsPerProfile) {
    return {
      message:
        access.plan === "free"
          ? "The free studio holds one product. The Launch Pack holds up to ten."
          : `This business has its ${access.productsPerProfile} products. Remove one to add another.`,
    };
  }
  let product;
  try {
    product = await repo.createProduct(profileId, parsed.data);
  } catch {
    return { message: "We couldn't find that business." };
  }
  redirect(`/studio/${profileId}/products/${product.id}?added=1`);
}

export async function updateProductAction(
  productId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { repo } = await studio();
  const product = await repo.getProduct(productId);
  if (!product) return { message: "We couldn't find that product." };
  const parsed = productFrom(form);
  if (!parsed.success)
    return { errors: fieldErrors(parsed.error), message: "A few details need another look." };
  await repo.updateProduct(productId, parsed.data);
  revalidatePath(`/studio/${product.profileId}`, "layout");
  return { ok: true, message: "Saved. Regenerate the listing or briefs to use the new details." };
}

export async function deleteProductAction(productId: string): Promise<void> {
  const { repo, user } = await studio();
  const product = await repo.getProduct(productId);
  if (!product) return;
  for (const key of product.imagePaths) await deleteUpload(user.id, key);
  await repo.deleteProduct(productId);
  redirect(`/studio/${product.profileId}/products`);
}

export async function uploadProductImageAction(
  productId: string,
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const { repo, user } = await studio();
  const product = await repo.getProduct(productId);
  if (!product) return { message: "We couldn't find that product." };
  if (product.imagePaths.length >= 8) return { message: "Up to eight photos per product." };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { message: "Choose a photo first." };
  const saved = await saveUpload(user.id, file);
  if (!saved.ok) return { message: saved.message };
  await repo.updateProduct(productId, product, [...product.imagePaths, saved.path]);
  revalidatePath(`/studio/${product.profileId}`, "layout");
  return { ok: true, message: "Photo added. Describe what's in it under “What's in your photos”." };
}

export async function removeProductImageAction(productId: string, key: string): Promise<void> {
  const { repo, user } = await studio();
  const product = await repo.getProduct(productId);
  if (!product || !product.imagePaths.includes(key)) return;
  await deleteUpload(user.id, key);
  await repo.updateProduct(
    productId,
    product,
    product.imagePaths.filter((p) => p !== key),
  );
  revalidatePath(`/studio/${product.profileId}`, "layout");
}

const taskPatch = z.object({
  status: z.enum(["not_started", "in_progress", "complete", "not_applicable"]).optional(),
  notes: z.string().max(2000).optional(),
});

export async function updateTaskAction(taskId: string, patch: unknown): Promise<{ ok: boolean }> {
  const { repo } = await studio();
  const parsed = taskPatch.safeParse(patch);
  if (!parsed.success) return { ok: false };
  if ((await loadAccess(repo)).access.plan === "free") return { ok: false };
  try {
    await repo.updateTask(taskId, parsed.data);
  } catch {
    return { ok: false };
  }
  if (parsed.data.status) await track("task_updated", repo.userId, { status: parsed.data.status });
  return { ok: true };
}
