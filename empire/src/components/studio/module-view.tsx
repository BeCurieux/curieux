import Link from "next/link";
import { METHODOLOGY } from "@/content/methodology";
import { mayGenerate, moduleAllowed } from "@/lib/billing/plans";
import { KIND_LABELS, MODULES, type AnyModuleOutput, type ModuleKey } from "@/lib/domain/modules";
import { sectionsOf } from "@/lib/generation/sections";
import { loadProfile } from "@/lib/studio/context";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Notice } from "@/components/ui/card";
import { AssetEditor } from "./asset-editor";
import { GenerateButton } from "./generate-button";
import { VersionHistory } from "./version-history";

// One module, start to finish: what it is, the generate button, the editor,
// warnings, staleness and version history. Every module page uses this.

/** What the free preview shows of the Brand Blueprint; the rest is locked. */
export const PREVIEW_SECTIONS: Partial<Record<ModuleKey, string[]>> = {
  brand_blueprint: ["positioning", "idealCustomer", "personality", "colourPalette"],
};

export async function ModuleView({
  profileId,
  module,
  productId = null,
  context,
}: {
  profileId: string;
  module: ModuleKey;
  productId?: string | null;
  context?: string;
}) {
  const { repo, profile, access, used, lastHour } = await loadProfile(profileId);
  const info = MODULES[module];
  const kind = KIND_LABELS[info.kind];
  const method = METHODOLOGY[module];
  const versions = await repo.listGenerations(profile.id, { module, productId });
  const current = versions.find((g) => g.status === "succeeded");
  const allowed = moduleAllowed(access, module);
  const refusal = mayGenerate(access, module, used, lastHour);
  const remaining = Math.max(0, access.generations - used);

  const preview = access.preview ? PREVIEW_SECTIONS[module] : undefined;
  let output = current?.output ?? null;
  let locked: string[] = [];
  if (output && preview) {
    const all = Object.keys(output);
    locked = all.filter((key) => !preview.includes(key));
    output = Object.fromEntries(
      Object.entries(output).filter(([key]) => preview.includes(key)),
    ) as AnyModuleOutput;
  }

  const stale = current && module !== "brand_blueprint" && current.profileVersion < profile.version;
  const sampleOnly = module === "theme_prompts" && access.preview;

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={
              info.kind === "copy"
                ? "success"
                : info.kind === "instruction"
                  ? "ink"
                  : info.kind === "brief"
                    ? "warning"
                    : "blush"
            }
          >
            {kind.label}
          </Badge>
          <Badge tone="outline">
            {method.status === "source"
              ? "Her Little Empire method"
              : method.status === "partial"
                ? "Her Little Empire method · some gaps"
                : method.status === "studio"
                  ? "Empire Studio method"
                  : "Interim method"}
          </Badge>
        </div>
        <h1 className="mt-4 text-4xl sm:text-5xl">
          {info.title}
          {context ? <span className="text-mute block text-2xl">{context}</span> : null}
        </h1>
        <p className="text-mute mt-3 text-lg">{info.summary}</p>
        <p className="text-charcoal mt-2 text-sm">{kind.explain}</p>
      </header>

      {!current && !allowed ? (
        <Card className="bg-blush-soft">
          <h2 className="text-2xl">Part of the Launch Pack</h2>
          <p className="mt-2">
            {info.summary} Built from your brand details — your saved work carries straight over
            when you upgrade.
          </p>
          <div className="mt-5">
            <ButtonLink href="/account">See the Launch Pack</ButtonLink>
          </div>
        </Card>
      ) : null}

      {!current && allowed ? (
        <Card>
          <h2 className="text-2xl">Ready when you are</h2>
          <p className="text-mute mt-2">
            We'll use {profile.brand ? "your Brand Blueprint and " : ""}your business details
            {info.scope === "product" ? " and this product's facts" : ""}. Anything missing is
            flagged, not made up.
            {sampleOnly
              ? " The free studio writes one sample prompt; the Launch Pack writes all ten."
              : ""}
          </p>
          {!profile.brand && module !== "brand_blueprint" ? (
            <p className="mt-2 text-sm">
              Tip:{" "}
              <Link
                href={`/studio/${profile.id}/brand`}
                className="text-aubergine font-semibold underline"
              >
                make your Brand Blueprint
              </Link>{" "}
              first so everything matches.
            </p>
          ) : null}
          <div className="mt-5">
            <GenerateButton
              profileId={profile.id}
              module={module}
              productId={productId}
              label={`Generate ${info.title.toLowerCase()}`}
              disabledReason={refusal?.message}
            />
          </div>
          <p className="text-mute mt-2 text-sm">
            {remaining} generation{remaining === 1 ? "" : "s"} left.
          </p>
        </Card>
      ) : null}

      {versions[0]?.status === "failed" && versions[0].id !== current?.id ? (
        <Notice tone="danger" title="The last attempt didn't work">
          {versions[0].error} It didn't use up a generation.
        </Notice>
      ) : null}

      {stale ? (
        <Notice tone="warning" title="Your business details have changed since this was made">
          This was written from an earlier version of your profile. Keep it as it is, or regenerate
          to use your latest details — your current version stays in the history either way.
        </Notice>
      ) : null}

      {current && current.warnings.length > 0 ? (
        <Notice tone="warning" title="Check these before you use it">
          <ul className="list-disc space-y-1 pl-5">
            {current.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Notice>
      ) : null}

      {current && output ? (
        <>
          <AssetEditor
            module={module}
            title={context ?? profile.brandName}
            generationId={current.id}
            version={current.version}
            profileId={profile.id}
            productId={productId}
            output={output}
            locked={locked}
            canRegenerate={allowed && !refusal && !sampleOnly}
            regenerableSections={preview ? [] : sectionsOf(module, current.output!)}
            readOnly={false}
          />
          {refusal && allowed ? <p className="text-mute text-sm">{refusal.message}</p> : null}
          {sampleOnly ? (
            <Card className="bg-blush-soft">
              <h2 className="text-2xl">Nine more prompts in the Launch Pack</h2>
              <p className="mt-2">
                Hero, announcement bar, featured products, benefits, product page, FAQ, about, email
                signup and footer — each with what to check after.
              </p>
              <div className="mt-4">
                <ButtonLink href="/account">See the Launch Pack</ButtonLink>
              </div>
            </Card>
          ) : null}
        </>
      ) : null}

      <VersionHistory
        versions={versions.slice(0, 30).map((g) => ({
          id: g.id,
          version: g.version,
          status: g.status,
          source: g.source,
          section: g.section,
          createdAt: g.createdAt,
          error: g.error,
          current: g.id === current?.id,
        }))}
      />

      {method.status !== "source" ? (
        <div className="text-mute text-xs">
          <p>
            {method.status === "partial"
              ? "Built on Her Little Empire's own method, with a few gaps still to fill:"
              : method.status === "studio"
                ? "Empire Studio's own method, written for this tool under Her Little Empire's rules. Still open:"
                : "No Her Little Empire method exists for this yet, so a general method runs under the brand's rules:"}
          </p>
          <ul className="mt-1 list-disc pl-5">
            {method.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
