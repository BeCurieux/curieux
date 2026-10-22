import { REFUND_POLICY, SELLER } from "@/lib/billing/plans";

// The seller details every Her Little Empire product carries.
export function Imprint({ className = "" }: { className?: string }) {
  return (
    <p className={`text-mute text-xs ${className}`}>
      {SELLER.name} · ABN {SELLER.abn} · {SELLER.country} ·{" "}
      <a href={`mailto:${SELLER.email}`} className="hover:text-aubergine underline">
        {SELLER.email}
      </a>{" "}
      · {REFUND_POLICY}
    </p>
  );
}
