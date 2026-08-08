"use client";

import { useState, useTransition } from "react";
import { deleteAccount, exportData } from "@/app/(product)/actions";
import { Button, Card, SectionLabel } from "@/components/ui";
import { browserClient } from "@/lib/supabase/client";
import { PRODUCT_NAME } from "@/config/brand";

/**
 * Data export and account deletion (§52).
 *
 * Deletion requires typing the word rather than a single confirm click. Not
 * friction for its own sake: this genuinely removes a household’s history, and
 * an accidental tap on a phone should not be able to do that.
 */
export function AccountActions() {
  const [confirmText, setConfirmText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function download() {
    startTransition(async () => {
      const result = await exportData();
      if (!result.ok || !result.data) {
        setMessage("Couldn’t build the export just now.");
        return;
      }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${PRODUCT_NAME.toLowerCase().replace(/\s+/g, "-")}-data.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteAccount();
      if (!result.ok) {
        setMessage(result.error ?? "Couldn’t delete the account.");
        return;
      }
      await browserClient().auth.signOut();
      window.location.href = "/";
    });
  }

  return (
    <Card className="p-6">
      <SectionLabel>Your data</SectionLabel>

      <div className="mt-3 space-y-4">
        <div>
          <p className="text-[15px] leading-relaxed text-graphite">
            Download everything we hold about your household — preferences, learned signals,
            every plan and every answer.
          </p>
          <div className="mt-3">
            <Button variant="secondary" size="sm" onClick={download} disabled={pending}>
              {pending ? "Preparing…" : "Export my data"}
            </Button>
          </div>
        </div>

        <div className="rule pt-4">
          <p className="text-[15px] leading-relaxed text-graphite">
            Delete your account and everything in it. Payment records are kept where the law
            requires, with your details removed from them. This cannot be undone.
          </p>

          {confirming ? (
            <div className="mt-3 space-y-3">
              <label htmlFor="confirm-delete" className="block text-[14px] text-graphite">
                Type <span className="font-semibold text-ink">delete</span> to confirm.
              </label>
              <input
                id="confirm-delete"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="h-11 w-full max-w-xs rounded-xl border border-rule bg-white px-4 text-[15px] text-ink"
              />
              <div className="flex gap-3">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending || confirmText.trim().toLowerCase() !== "delete"}
                  onClick={remove}
                >
                  {pending ? "Deleting…" : "Delete my account"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
                Delete my account
              </Button>
            </div>
          )}
        </div>
      </div>

      {message ? (
        <p role="alert" className="mt-4 text-[14px] text-clay">
          {message}
        </p>
      ) : null}
    </Card>
  );
}
