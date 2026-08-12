"use client";

// The builder (brief §14, §15, §16).
//
//   ┌──────────────────────────────────────────────────┐
//   │ name · saving… · view live · Publish             │
//   ├───────────┬──────────────────────┬───────────────┤
//   │ steps     │ live preview         │ inspector     │
//   │ + add     │ desktop/tablet/mobile│ content       │
//   │           │                      │ design        │
//   │           │                      │ logic         │
//   └───────────┴──────────────────────┴───────────────┘
//
// The document lives here, in one piece of state, and the preview is the real
// renderer reading that state. There is no compile step between editing and
// previewing, which is why §15's "changes should update immediately" is just
// how it works rather than something to implement.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ContentTab } from "./ContentTab";
import { DesignTab } from "./DesignTab";
import { LogicTab } from "./LogicTab";
import { SharePanel, SignupPanel } from "./PublishPanel";
import { StepList } from "./StepList";
import { VIEWPORTS, type Selection, type ViewportId } from "./types";
import { Logo } from "@/components/site/Chrome";
import {
  ArrowLeftIcon,
  BranchIcon,
  CheckIcon,
  DesktopIcon,
  EyeIcon,
  MobileIcon,
  PaletteIcon,
  TabletIcon,
  TextIcon,
} from "@/components/ui/Icons";
import { WidgetRenderer } from "@/components/widget/WidgetRenderer";
import { publishWidget, saveWidget } from "@/app/actions";
import { fieldise } from "@/lib/widget/format";
import { validateStructure, widgetSchema, type WidgetDocument } from "@/lib/widget/schema";

type SaveState = "idle" | "saving" | "saved" | "error";
type Tab = "content" | "design" | "logic";

export interface BuilderProps {
  widgetId: string;
  slug: string;
  initialDocument: WidgetDocument;
  initialStatus: "draft" | "published";
  origin: string;
  isRegistered: boolean;
  planName: string;
  capabilities: {
    leadCapture: boolean;
    removeBadge: boolean;
    premiumThemes: boolean;
    advancedLogic: boolean;
  };
  /** One-off message from the generator ("we started you off from…"). */
  note?: string;
}

export function Builder({
  widgetId,
  slug,
  initialDocument,
  initialStatus,
  origin,
  isRegistered,
  planName,
  capabilities,
  note,
}: BuilderProps) {
  const router = useRouter();
  const [doc, setDoc] = useState<WidgetDocument>(initialDocument);
  const [status, setStatus] = useState(initialStatus);
  const [selection, setSelection] = useState<Selection>(
    initialDocument.steps[0] ? { kind: "step", id: initialDocument.steps[0].id } : { kind: "intro" }
  );
  const [tab, setTab] = useState<Tab>("content");
  const [viewport, setViewport] = useState<ViewportId>("desktop");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [dialog, setDialog] = useState<"none" | "signup" | "share">("none");
  const [message, setMessage] = useState<string | null>(note ?? null);
  const [dirty, setDirty] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(doc);
  latest.current = doc;

  const issues = validateStructure(doc);

  /* ---- Autosave (§33) --------------------------------------------- */

  const flush = useCallback(async () => {
    setSaveState("saving");
    const result = await saveWidget(widgetId, latest.current);
    setSaveState(result.ok ? "saved" : "error");
    if (result.ok) setDirty(false);
  }, [widgetId]);

  const update = useCallback(
    (mutate: (draft: WidgetDocument) => WidgetDocument) => {
      setDoc((current) => mutate(current));
      setDirty(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void flush(), 700);
    },
    [flush]
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Closing the tab mid-edit shouldn't silently discard the last keystrokes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ---- Step operations -------------------------------------------- */

  const reorder = (from: number, to: number) =>
    update((draft) => {
      const steps = [...draft.steps];
      const [moved] = steps.splice(from, 1);
      steps.splice(Math.max(0, Math.min(steps.length, to)), 0, moved);
      return { ...draft, steps };
    });

  const addStep = () => {
    const id = uniqueFieldId(doc, "question");
    update((draft) => ({
      ...draft,
      steps: [
        ...draft.steps,
        {
          id,
          title: "Your new question",
          required: true,
          hidden: false,
          input: {
            kind: "choice",
            multiple: false,
            columns: 3,
            options: [
              { id: "one", label: "One", value: 1 },
              { id: "two", label: "Two", value: 2 },
              { id: "three", label: "Three", value: 3 },
            ],
          },
        },
      ],
    }));
    setSelection({ kind: "step", id });
    setTab("content");
  };

  const deleteStep = (stepId: string) => {
    update((draft) => ({
      ...draft,
      steps: draft.steps.filter((step) => step.id !== stepId),
      // A rule about a question that no longer exists would be dead weight.
      logic: draft.logic.filter((rule) => !mentions(rule, stepId)),
    }));
    setSelection((current) =>
      current.kind === "step" && current.id === stepId ? { kind: "result" } : current
    );
  };

  /* ---- Publish (§34) ---------------------------------------------- */

  const doPublish = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await flush();

    const result = await publishWidget(widgetId);
    if (result.ok) {
      setStatus("published");
      setDialog("share");
      router.refresh();
      return;
    }
    if (result.error === "signup-required") {
      setDialog("signup");
      return;
    }
    setMessage(result.error ?? "We couldn't publish that.");
  };

  const preview = widgetSchema.parse({ ...doc, id: widgetId, slug, status });
  const activeStepId =
    selection.kind === "step" ? selection.id : selection.kind === "intro" ? "__intro__" : null;

  const editorProps = { doc, update, selection, select: setSelection, capabilities, planName };

  return (
    <div className="flex h-screen flex-col bg-lavender">
      {/* ---- Top bar ------------------------------------------------ */}
      <header className="flex flex-none items-center gap-3 border-b border-rule bg-white px-4 py-2.5">
        <Link href="/dashboard" className="btn-ghost px-2" aria-label="Back to your widgets">
          <ArrowLeftIcon size={18} />
        </Link>
        <Link href="/" className="hidden sm:block" aria-label="Home">
          <Logo size={26} />
        </Link>

        <input
          className="min-w-0 flex-1 rounded-btn border border-transparent px-2 py-1.5 text-sm font-bold text-navy transition hover:border-rule focus:border-purple focus:outline-none"
          value={doc.name}
          maxLength={120}
          aria-label="Widget name"
          onChange={(event) => update((draft) => ({ ...draft, name: event.target.value }))}
        />

        <SaveIndicator state={saveState} dirty={dirty} />

        {/* Which plan you're on decides what half the inspector will let you
            do, so it belongs where you can see it — and it goes to the page
            that explains the difference rather than being a dead label. */}
        <Link
          href="/pricing"
          className="hidden flex-none rounded-full border border-rule px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate transition hover:border-purple-mid hover:text-purple sm:block"
          title={`You're on the ${planName} plan — compare plans`}
        >
          {planName}
        </Link>

        {status === "published" ? (
          <a
            href={`${origin}/w/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost hidden sm:inline-flex"
          >
            <EyeIcon size={16} />
            View live
          </a>
        ) : null}

        <button type="button" className="btn" onClick={() => void doPublish()}>
          {status === "published" ? "Publish changes" : "Publish"}
        </button>
      </header>

      {message ? (
        <div className="flex flex-none items-center justify-between gap-3 border-b border-yellow/40 bg-yellow-soft px-4 py-2 text-sm">
          <span>{message}</span>
          <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => setMessage(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {/* ---- Three columns ------------------------------------------ */}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_336px]">
        <aside className="hidden min-h-0 overflow-hidden border-r border-rule bg-white lg:block">
          <StepList
            doc={doc}
            selection={selection}
            select={(next) => {
              setSelection(next);
              setTab("content");
            }}
            onReorder={reorder}
            onAdd={addStep}
            onDelete={deleteStep}
          />
        </aside>

        <main className="flex min-h-0 flex-col overflow-y-auto">
          <div className="flex flex-none items-center justify-between gap-2 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Live preview</p>
            <div className="flex gap-1 rounded-btn border border-rule bg-white p-1">
              {(Object.keys(VIEWPORTS) as ViewportId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setViewport(id)}
                  aria-label={VIEWPORTS[id].label}
                  aria-pressed={viewport === id}
                  className={`grid h-8 w-8 place-items-center rounded-[10px] transition ${
                    viewport === id ? "bg-purple-soft text-purple" : "text-muted hover:text-navy"
                  }`}
                >
                  {id === "desktop" ? (
                    <DesktopIcon size={16} />
                  ) : id === "tablet" ? (
                    <TabletIcon size={16} />
                  ) : (
                    <MobileIcon size={16} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* The preview sits in the middle of its column rather than pinned
              to the top with a screenful of empty lavender underneath. Short
              widgets are the common case, so the common case is what this is
              laid out for. */}
          <div className="centre-safe flex flex-1 flex-col px-4 pb-8 pt-1">
            <div
              className="mx-auto w-full transition-[max-width] duration-300"
              style={{ maxWidth: VIEWPORTS[viewport].width }}
            >
              <WidgetRenderer
                widget={preview}
                live={false}
                showBadge={doc.settings.showBadge || !capabilities.removeBadge}
                activeStepId={activeStepId}
              />
            </div>

            {issues.length > 0 ? (
              <div className="mx-auto mt-5 max-w-xl rounded-card border border-yellow/50 bg-yellow-soft p-4">
                <p className="text-sm font-bold">A couple of things to tidy up</p>
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate">
                  {issues.slice(0, 5).map((issue, index) => (
                    <li key={index}>• {issue.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto border-t border-rule bg-white lg:border-l lg:border-t-0">
          <div className="sticky top-0 z-10 flex gap-1 border-b border-rule bg-white px-3 py-2">
            <TabButton active={tab === "content"} onClick={() => setTab("content")} icon={<TextIcon size={15} />}>
              Content
            </TabButton>
            <TabButton active={tab === "design"} onClick={() => setTab("design")} icon={<PaletteIcon size={15} />}>
              Design
            </TabButton>
            <TabButton active={tab === "logic"} onClick={() => setTab("logic")} icon={<BranchIcon size={15} />}>
              Logic
            </TabButton>
          </div>

          {tab === "content" ? <ContentTab {...editorProps} /> : null}
          {tab === "design" ? <DesignTab {...editorProps} /> : null}
          {tab === "logic" ? <LogicTab {...editorProps} /> : null}
        </aside>
      </div>

      {/* Small screens get the step list under the preview rather than not at
          all — the builder is optimised for desktop but not broken below it. */}
      <div className="border-t border-rule bg-white lg:hidden">
        <StepList
          doc={doc}
          selection={selection}
          select={(next) => {
            setSelection(next);
            setTab("content");
          }}
          onReorder={reorder}
          onAdd={addStep}
          onDelete={deleteStep}
        />
      </div>

      {dialog === "signup" && !isRegistered ? (
        <SignupPanel
          onClose={() => setDialog("none")}
          onDone={() => {
            setDialog("none");
            void doPublish();
          }}
        />
      ) : null}

      {dialog === "share" ? (
        <SharePanel slug={slug} origin={origin} onClose={() => setDialog("none")} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SaveIndicator({ state, dirty }: { state: SaveState; dirty: boolean }) {
  // Always says something. At rest the document on screen *is* the document in
  // the store — autosave has either just run or has had nothing to do — so
  // "Saved" is the truthful label, and a bar that only speaks up mid-save
  // leaves you wondering for the other 99% of the time (§33).
  const settled = !dirty && state !== "saving" && state !== "error";
  const label =
    state === "saving" ? "Saving…" : state === "error" ? "Not saved" : dirty ? "Unsaved" : "Saved";

  return (
    <span
      className={`hidden flex-none items-center gap-1 whitespace-nowrap text-xs font-medium sm:flex ${
        state === "error" ? "text-coral" : "text-muted"
      }`}
      aria-live="polite"
    >
      {settled ? <CheckIcon size={13} className="text-mint" /> : null}
      {label}
    </span>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-btn px-2 py-2 text-xs font-bold uppercase tracking-wide transition ${
        active ? "bg-purple-soft text-purple" : "text-muted hover:text-navy"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function uniqueFieldId(doc: WidgetDocument, base: string): string {
  const taken = new Set(doc.steps.map((step) => step.id));
  const root = fieldise(base, "question");
  if (!taken.has(root)) return root;
  for (let suffix = 2; suffix < 100; suffix += 1) {
    if (!taken.has(`${root}_${suffix}`)) return `${root}_${suffix}`;
  }
  return `${root}_${Date.now()}`;
}

/** Does this rule mention a step, in its condition or its action? */
function mentions(rule: { when: unknown; then: Record<string, unknown> }, stepId: string): boolean {
  const when = rule.when as Record<string, unknown>;
  const conditions = Array.isArray(when.all)
    ? (when.all as Array<{ field: string }>)
    : Array.isArray(when.any)
      ? (when.any as Array<{ field: string }>)
      : [when as unknown as { field: string }];

  if (conditions.some((condition) => condition?.field === stepId)) return true;
  return rule.then.show === stepId || rule.then.hide === stepId;
}
