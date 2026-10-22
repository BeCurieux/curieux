import { strToU8, zipSync } from "fflate";
import { tasksFor } from "@/lib/checklist/tasks";
import { MODULES, MODULE_KEYS } from "@/lib/domain/modules";
import type { BusinessProfile } from "@/lib/domain/profile";
import type { Product } from "@/lib/domain/product";
import { TASK_STATUS_LABELS, type Generation, type LaunchTask } from "@/lib/domain/records";
import { toMarkdown } from "./markdown";

// The downloadable launch pack: one Markdown file per asset, in folders a
// person can find their way around, plus a README and the checklist.

const slug = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "item";

export function packFiles(
  profile: BusinessProfile,
  products: Product[],
  assets: Generation[],
  tasks: LaunchTask[],
): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const byProduct = new Map(products.map((p) => [p.id, p]));
  const order = (g: Generation) => MODULE_KEYS.indexOf(g.module);

  for (const g of [...assets].sort((a, b) => order(a) - order(b))) {
    if (!g.output) continue;
    const info = MODULES[g.module];
    const product = g.productId ? byProduct.get(g.productId) : undefined;
    const folder = info.scope === "product" ? `products/${slug(product?.name ?? "product")}` : info.studio;
    files.push({
      path: `${folder}/${slug(info.title)}.md`,
      content: toMarkdown(g.module, g.output, product?.name ?? profile.brandName),
    });
  }

  const applicable = new Set(tasksFor(profile).map((t) => t.key));
  const checklist = tasks
    .filter((t) => applicable.has(t.taskKey))
    .map((t) => `- [${t.status === "complete" ? "x" : " "}] ${t.label} — ${TASK_STATUS_LABELS[t.status]}${t.notes ? `\n  Notes: ${t.notes}` : ""}`)
    .join("\n");
  files.push({ path: "launch-checklist.md", content: `# Launch checklist — ${profile.brandName}\n\n${checklist}\n` });

  files.push({
    path: "README.md",
    content: `# ${profile.brandName} — launch pack

Made with Empire Studio by Her Little Empire on ${new Date().toISOString().slice(0, 10)}.

- **brand/** — your Brand Blueprint
- **theme/** — store design brief, Shopify Sidekick prompts, homepage copy
- **products/** — a listing and photo briefs for each product
- **marketing/** — launch emails and social launch kit
- **launch-checklist.md** — where you're up to

Before you publish anything: check every fact, price, policy and claim is true for your business.
Sidekick prompts are instructions — review every change on a duplicate theme before publishing.
Photo briefs are plans, not photos — make sure every image matches the real product.
`,
  });
  return files;
}

export function zipPack(files: { path: string; content: string }[], root: string): Uint8Array {
  const tree: Record<string, Uint8Array> = {};
  for (const file of files) tree[`${root}/${file.path}`] = strToU8(file.content);
  return zipSync(tree, { level: 6 });
}

export { slug };
