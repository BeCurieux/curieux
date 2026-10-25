import { REFUND_POLICY, SELLER } from "@/lib/billing/plans";

// The footer every Her Little Empire product carries, exactly as the founder
// set it: "Her Little Empire · ABN 38 813 430 864 · hello@herlittleempire.com",
// with the refund sentence on its own line.
export function Imprint({ className = "" }: { className?: string }) {
  return (
    <div className={`text-mute text-xs ${className}`}>
      <p>
        {SELLER.name} · ABN {SELLER.abn} ·{" "}
        <a href={`mailto:${SELLER.email}`} className="hover:text-aubergine underline">
          {SELLER.email}
        </a>
      </p>
      <p className="mt-1">{REFUND_POLICY}</p>
    </div>
  );
}
