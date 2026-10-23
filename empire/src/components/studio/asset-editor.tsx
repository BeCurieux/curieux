"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { generateAction, saveEditAction } from "@/app/studio/actions";
import { sendEvent } from "@/components/beacon";
import { Button } from "@/components/ui/button";
import { Badge, Notice } from "@/components/ui/card";
import { labelFor, sectionMarkdown, toMarkdown } from "@/lib/export/markdown";
import type { AnyModuleOutput, ModuleKey } from "@/lib/domain/modules";
import { CopyButton } from "./copy-button";

// Edits any module's output. The output is rendered field by field from its
// own shape, so every generated word is editable without a bespoke form per
// module. Saving creates a new version; nothing is overwritten.

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const ENUMS: Record<string, string[]> = { manualAdjustments: ["unlikely", "possible", "likely"] };
const MONO = new Set(["prompt"]);
const LONG = new Set([
  "prompt",
  "body",
  "description",
  "aboutBlurb",
  "caption",
  "setup",
  "idealCustomer",
  "positioning",
  "photography",
]);
const COPY_LEAF = new Set([
  "prompt",
  "body",
  "description",
  "subject",
  "caption",
  "seoTitle",
  "seoDescription",
  "shortDescription",
  "heroHeadline",
  "heroSubheadline",
  "aboutBlurb",
]);

function setAt(root: Json, path: (string | number)[], value: Json): Json {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(root)) {
    const copy = [...root];
    copy[head as number] = setAt(copy[head as number] as Json, rest, value);
    return copy;
  }
  const obj = { ...(root as Record<string, Json>) };
  obj[head as string] = setAt(obj[head as string] as Json, rest, value);
  return obj;
}

function blank(shape: Json): Json {
  if (typeof shape === "string") return "";
  if (typeof shape === "number") return shape;
  if (Array.isArray(shape)) return [];
  if (shape && typeof shape === "object") {
    return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, blank(v)]));
  }
  return shape;
}

function rowsFor(text: string, long: boolean) {
  const lines = text.split("\n").length + Math.floor(text.length / 70);
  return Math.min(Math.max(long ? 4 : 1, lines), 18);
}

function Leaf({
  id,
  name,
  value,
  onChange,
  readOnly,
}: {
  id: string;
  name: string;
  value: Json;
  onChange: (v: Json) => void;
  readOnly: boolean;
}) {
  if (typeof value === "number") {
    return (
      <input
        id={id}
        type="number"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(Number(e.target.value))}
        className="field-input max-w-32"
      />
    );
  }
  if (ENUMS[name]) {
    return (
      <select
        id={id}
        value={String(value)}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className="field-input max-w-48"
      >
        {ENUMS[name].map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  const text = String(value ?? "");
  const long = LONG.has(name);
  if (name === "hex") {
    const valid = /^#[0-9a-f]{6}$/i.test(text);
    return (
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="border-line size-11 shrink-0 rounded-xl border"
          style={{ background: valid ? text : "transparent" }}
        />
        <input
          id={id}
          value={text}
          readOnly={readOnly}
          onChange={(e) => onChange(e.target.value)}
          className="field-input max-w-40 font-mono"
        />
      </div>
    );
  }
  return (
    <textarea
      id={id}
      value={text}
      readOnly={readOnly}
      rows={rowsFor(text, long)}
      onChange={(e) => onChange(e.target.value)}
      className={`field-input ${MONO.has(name) ? "bg-blush-soft font-mono text-sm" : ""}`}
    />
  );
}

function Node({
  path,
  name,
  value,
  onChange,
  readOnly,
  depth,
}: {
  path: (string | number)[];
  name: string;
  value: Json;
  onChange: (path: (string | number)[], v: Json) => void;
  readOnly: boolean;
  depth: number;
}) {
  const id = `f-${path.join("-")}`;
  const label =
    typeof path.at(-1) === "number"
      ? `${labelFor(name)} ${(path.at(-1) as number) + 1}`
      : labelFor(name);

  if (Array.isArray(value)) {
    const objects = value.length > 0 && typeof value[0] === "object" && value[0] !== null;
    return (
      <fieldset className="space-y-3">
        {depth > 0 ? (
          <legend className="text-charcoal mb-2 text-sm font-semibold">{labelFor(name)}</legend>
        ) : null}
        {value.map((item, i) =>
          objects ? (
            <div key={i} className="border-line bg-ivory rounded-2xl border p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-aubergine text-sm font-semibold">{itemTitle(item, i)}</p>
                <div className="flex items-center gap-1">
                  <CopyButton
                    text={sectionMarkdown(name, [item])}
                    label="Copy"
                    event={{ section: name }}
                  />
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(
                          path,
                          value.filter((_, j) => j !== i),
                        )
                      }
                      className="text-mute hover:text-danger min-h-9 px-2 text-sm"
                      aria-label={`Remove ${itemTitle(item, i)}`}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              <Node
                path={[...path, i]}
                name={name}
                value={item}
                onChange={onChange}
                readOnly={readOnly}
                depth={depth + 1}
              />
            </div>
          ) : (
            <div key={i} className="flex items-start gap-2">
              <label
                htmlFor={`${id}-${i}`}
                className="sr-only"
              >{`${labelFor(name)} ${i + 1}`}</label>
              <div className="flex-1">
                <Leaf
                  id={`${id}-${i}`}
                  name={name}
                  value={item}
                  onChange={(v) => onChange([...path, i], v)}
                  readOnly={readOnly}
                />
              </div>
              {!readOnly ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      path,
                      value.filter((_, j) => j !== i),
                    )
                  }
                  className="text-mute hover:text-danger min-h-11 px-2 text-sm"
                  aria-label={`Remove ${labelFor(name)} ${i + 1}`}
                >
                  ✕
                </button>
              ) : null}
            </div>
          ),
        )}
        {!readOnly ? (
          <button
            type="button"
            onClick={() => onChange(path, [...value, value.length > 0 ? blank(value[0]!) : ""])}
            className="text-aubergine min-h-10 text-sm font-semibold hover:underline"
          >
            + Add {labelFor(name).toLowerCase().replace(/s$/, "")}
          </button>
        ) : null}
      </fieldset>
    );
  }

  if (value && typeof value === "object") {
    return (
      <div className="space-y-4">
        {Object.entries(value)
          .filter(([key]) => key !== "key")
          .map(([key, child]) => (
            <Node
              key={key}
              path={[...path, key]}
              name={key}
              value={child}
              onChange={onChange}
              readOnly={readOnly}
              depth={depth + 1}
            />
          ))}
      </div>
    );
  }

  // A top-level field already sits under its section heading.
  const topLevel = path.length === 1;
  return (
    <div className="space-y-1.5">
      <div
        className={`flex items-center justify-between gap-2 ${topLevel && !COPY_LEAF.has(name) ? "sr-only" : ""}`}
      >
        <label
          htmlFor={id}
          className={topLevel ? "sr-only" : "text-charcoal text-sm font-semibold"}
        >
          {label}
        </label>
        {COPY_LEAF.has(name) && typeof value === "string" ? (
          <CopyButton
            text={value}
            label={name === "prompt" ? "Copy prompt" : "Copy"}
            event={{ section: name }}
          />
        ) : null}
      </div>
      <Leaf
        id={id}
        name={name}
        value={value}
        onChange={(v) => onChange(path, v)}
        readOnly={readOnly}
      />
    </div>
  );
}

function itemTitle(item: Json, i: number) {
  if (item && typeof item === "object" && !Array.isArray(item)) {
    for (const key of [
      "title",
      "subject",
      "section",
      "trait",
      "name",
      "label",
      "feature",
      "question",
      "purpose",
    ]) {
      const v = (item as Record<string, Json>)[key];
      if (typeof v === "string" && v) return v.length > 60 ? `${v.slice(0, 57)}…` : v;
    }
    const day = (item as Record<string, Json>).day;
    if (typeof day === "number") return `Day ${day}`;
  }
  return `#${i + 1}`;
}

export interface EditorProps {
  module: ModuleKey;
  title: string;
  generationId: string;
  version: number;
  profileId: string;
  productId: string | null;
  output: AnyModuleOutput;
  /** Sections hidden in the free preview. */
  locked: string[];
  canRegenerate: boolean;
  regenerableSections: string[];
  readOnly: boolean;
}

export function AssetEditor(props: EditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<Json>(props.output as unknown as Json);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "danger";
    text: string;
    issues?: string[];
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [baseId, setBaseId] = useState(props.generationId);

  // A new version arrived from the server (save, regenerate, restore).
  if (baseId !== props.generationId) {
    setBaseId(props.generationId);
    setDraft(props.output as unknown as Json);
    setDirty(false);
  }

  const markdown = useMemo(
    () => toMarkdown(props.module, draft as unknown as AnyModuleOutput, props.title),
    [draft, props.module, props.title],
  );

  const onChange = (path: (string | number)[], value: Json) => {
    setDraft((current) => setAt(current, path, value));
    setDirty(true);
    setMessage(null);
  };

  const save = () => {
    setBusy("save");
    startTransition(async () => {
      const result = await saveEditAction(props.generationId, draft);
      setBusy(null);
      setMessage(
        result.ok
          ? { tone: "success", text: result.message ?? "Saved." }
          : { tone: "danger", text: result.message ?? "Couldn't save.", issues: result.issues },
      );
      if (result.ok) {
        setDirty(false);
        router.refresh();
      }
    });
  };

  const regenerate = (section: string | null) => {
    if (
      dirty &&
      !window.confirm(
        "You have unsaved edits. Regenerating replaces what's on screen with a new version (your saved versions are kept). Continue?",
      )
    )
      return;
    setBusy(section ?? "all");
    startTransition(async () => {
      const result = await generateAction({
        profileId: props.profileId,
        module: props.module,
        productId: props.productId,
        section,
      });
      setBusy(null);
      setMessage(
        result.ok
          ? {
              tone: "success",
              text: section
                ? `Regenerated “${labelFor(section.replace(/^prompt:/, ""))}”.`
                : "Regenerated. Your previous version is in the history below.",
            }
          : { tone: "danger", text: result.message ?? "That didn't work." },
      );
      router.refresh();
    });
  };

  const download = () => {
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.module.replace(/_/g, "-")}-v${props.version}.md`;
    a.click();
    URL.revokeObjectURL(url);
    sendEvent("asset_downloaded", { module: props.module, format: "md" });
  };

  const entries = Object.entries(draft as Record<string, Json>);

  return (
    <div className="space-y-6">
      <div className="no-print border-line bg-ivory/95 sticky top-0 z-20 -mx-5 flex flex-wrap items-center gap-2 border-b px-5 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <Badge tone="outline">Version {props.version}</Badge>
        {dirty ? (
          <Badge tone="warning">Unsaved changes</Badge>
        ) : (
          <Badge tone="success">Saved</Badge>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <CopyButton
            text={markdown}
            label="Copy all"
            event={{ module: props.module }}
            variant="secondary"
          />
          <Button type="button" variant="secondary" onClick={download}>
            Download .md
          </Button>
          {props.canRegenerate ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => regenerate(null)}
              disabled={busy !== null}
            >
              {busy === "all" ? "Writing…" : "Regenerate all"}
            </Button>
          ) : null}
          {!props.readOnly ? (
            <Button type="button" onClick={save} disabled={!dirty || busy !== null}>
              {busy === "save" ? "Saving…" : "Save changes"}
            </Button>
          ) : null}
        </div>
      </div>

      {message ? (
        <Notice tone={message.tone}>
          {message.text}
          {message.issues ? (
            <ul className="mt-2 list-disc pl-5">
              {message.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}

      {entries.map(([key, value]) => (
        <section
          key={key}
          aria-labelledby={`h-${key}`}
          className="border-line bg-paper rounded-3xl border p-5 sm:p-7"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id={`h-${key}`} className="text-2xl">
              {labelFor(key)}
            </h2>
            <div className="no-print flex items-center gap-1">
              <CopyButton
                text={sectionMarkdown(key, value)}
                label="Copy"
                event={{ module: props.module, section: key }}
              />
              {props.canRegenerate && props.regenerableSections.includes(key) ? (
                <Button
                  type="button"
                  variant="quiet"
                  onClick={() => regenerate(key)}
                  disabled={busy !== null}
                >
                  {busy === key ? "Writing…" : "Regenerate"}
                </Button>
              ) : null}
            </div>
          </div>
          {key === "prompts" && Array.isArray(value) ? (
            <PromptCards
              prompts={value}
              readOnly={props.readOnly}
              onChange={onChange}
              canRegenerate={props.canRegenerate}
              busy={busy}
              regenerate={regenerate}
            />
          ) : (
            <Node
              path={[key]}
              name={key}
              value={value}
              onChange={onChange}
              readOnly={props.readOnly}
              depth={0}
            />
          )}
        </section>
      ))}

      {props.locked.map((key) => (
        <section
          key={key}
          className="border-aubergine/40 bg-blush-soft rounded-3xl border border-dashed p-5 sm:p-7"
        >
          <h2 className="text-2xl">{labelFor(key)}</h2>
          <p className="text-charcoal mt-2">
            Part of the Launch Pack. Upgrade and it'll be here, ready to edit — nothing you've made
            so far is lost.
          </p>
        </section>
      ))}
    </div>
  );
}

function PromptCards({
  prompts,
  readOnly,
  onChange,
  canRegenerate,
  busy,
  regenerate,
}: {
  prompts: Json[];
  readOnly: boolean;
  onChange: (path: (string | number)[], v: Json) => void;
  canRegenerate: boolean;
  busy: string | null;
  regenerate: (section: string) => void;
}) {
  return (
    <ol className="space-y-5">
      {prompts.map((raw, i) => {
        const p = raw as Record<string, Json>;
        const tone =
          p.manualAdjustments === "likely"
            ? "warning"
            : p.manualAdjustments === "possible"
              ? "blush"
              : "success";
        return (
          <li
            key={String(p.key ?? i)}
            className="border-line bg-ivory rounded-2xl border p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="eyebrow">Prompt {i + 1}</p>
                <h3 className="mt-1 text-xl">{String(p.title)}</h3>
              </div>
              <div className="no-print flex flex-wrap items-center gap-1">
                <Badge tone={tone}>Manual tweaks {String(p.manualAdjustments)}</Badge>
                {canRegenerate ? (
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => regenerate(`prompt:${String(p.key)}`)}
                    disabled={busy !== null}
                  >
                    {busy === `prompt:${String(p.key)}` ? "Writing…" : "Regenerate"}
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="mt-4">
              <Node
                path={["prompts", i]}
                name="prompts"
                value={raw}
                onChange={onChange}
                readOnly={readOnly}
                depth={1}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
