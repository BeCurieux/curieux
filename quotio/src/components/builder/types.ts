import type { WidgetDocument } from "@/lib/widget/schema";

/** What the inspector is currently pointed at (§16). */
export type Selection = { kind: "intro" } | { kind: "step"; id: string } | { kind: "result" };

export interface EditorProps {
  doc: WidgetDocument;
  update: (mutate: (draft: WidgetDocument) => WidgetDocument) => void;
  selection: Selection;
  select: (selection: Selection) => void;
  /** Capabilities the owner's plan allows, for honest gating in the UI (§35). */
  capabilities: {
    leadCapture: boolean;
    removeBadge: boolean;
    premiumThemes: boolean;
    advancedLogic: boolean;
    /**
     * Not a plan gate — whether this deployment has a mail provider at all.
     * Lives here because it decides the same thing the others do: which
     * controls the panel is allowed to offer honestly (§41).
     */
    emailEnabled: boolean;
  };
  planName: string;
}

/** The preview's device width, in the order the toolbar shows them (§15). */
export const VIEWPORTS = {
  desktop: { label: "Desktop", width: "100%" },
  tablet: { label: "Tablet", width: "768px" },
  mobile: { label: "Mobile", width: "390px" },
} as const;

export type ViewportId = keyof typeof VIEWPORTS;
