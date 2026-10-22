"use client";

import { sendEvent } from "@/components/beacon";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      type="button"
      onClick={() => {
        sendEvent("asset_downloaded", { format: "print" });
        window.print();
      }}
    >
      Print or save as PDF
    </Button>
  );
}
