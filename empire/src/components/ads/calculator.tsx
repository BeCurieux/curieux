"use client";

import { useMemo, useState } from "react";
import { FORMULAS } from "@/lib/ads/calculator";
import {
  CURRENCIES,
  DEFAULT_FORM,
  formatMoney,
  formatRatio,
  interpret,
  run,
  toCsv,
  type CalculatorForm,
  type Currency,
} from "@/lib/ads/calculator-view";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";

// The free Ads Profitability Calculator. Everything is worked out in the
// browser: nothing typed here is sent anywhere or saved.

type Key = keyof CalculatorForm;

const GUMROAD_FIXED: Partial<Record<Currency, string>> = { USD: "0.50", AUD: "0.80" };

export function AdsCalculator() {
  const [form, setForm] = useState<CalculatorForm>(DEFAULT_FORM);
  const { errors, result } = useMemo(() => run(form), [form]);
  const set = (key: Key, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const money = (v: number | null) => formatMoney(v, form.currency);
  const sym = CURRENCIES[form.currency];

  const field = (
    key: Key,
    label: string,
    { hint, unit, step = "0.01" }: { hint?: string; unit?: string; step?: string } = {},
  ) => {
    const id = `ads-${key}`;
    const error = errors[key];
    const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
      .filter(Boolean)
      .join(" ");
    return (
      <div className="space-y-1">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
          {unit ? <span className="text-mute font-normal"> ({unit})</span> : null}
        </label>
        <input
          id={id}
          type="number"
          min={0}
          step={step}
          inputMode="decimal"
          value={form[key]}
          onChange={(e) => set(key, e.target.value)}
          className="field-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {hint ? (
          <p id={`${id}-hint`} className="text-mute text-xs">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} className="text-danger text-xs font-medium">
            {error}
          </p>
        ) : null}
      </div>
    );
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([toCsv(form, result)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ads-profitability.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const readings = result ? interpret(result, form.currency) : [];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form className="no-print space-y-6" onSubmit={(e) => e.preventDefault()} noValidate>
        <Card>
          <h2 className="text-2xl">Your product</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="ads-currency" className="text-sm font-semibold">
                Currency
              </label>
              <select
                id="ads-currency"
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
                className="field-input"
              >
                {Object.entries(CURRENCIES).map(([code, s]) => (
                  <option key={code} value={code}>
                    {code} ({s})
                  </option>
                ))}
              </select>
            </div>
            {field("price", "Price", { unit: sym, hint: "What the customer sees." })}
            {field("discountPct", "Discount", { unit: "%", hint: "Leave empty for none." })}
            {field("costs", "Costs per order", {
              unit: sym,
              hint: "Anything you pay each time someone buys. Often 0 for a download.",
            })}
            {field("refundPct", "Orders refunded", {
              unit: "%",
              hint: "No history yet? 5% is a cautious starting guess.",
            })}
          </div>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">GST or VAT</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["not_registered", "Not registered"],
                  ["inclusive", "Included in price"],
                  ["exclusive", "Added at checkout"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="border-line flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm"
                >
                  <input
                    type="radio"
                    name="gst"
                    value={value}
                    checked={form.gstMode === value}
                    onChange={() => set("gstMode", value)}
                  />
                  {label}
                </label>
              ))}
            </div>
            {form.gstMode !== "not_registered" ? (
              <div className="mt-3 max-w-48">{field("gstRatePct", "Rate", { unit: "%" })}</div>
            ) : null}
          </fieldset>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold">Payment fees</legend>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              {field("feePct", "Percentage fee", { unit: "%" })}
              {field("feeFixed", "Fixed fee per sale", { unit: sym })}
            </div>
            <button
              type="button"
              className="text-aubergine mt-2 text-sm underline underline-offset-4"
              onClick={() =>
                setForm((f) => ({
                  ...f,
                  feePct: "10",
                  feeFixed: GUMROAD_FIXED[f.currency] ?? f.feeFixed,
                }))
              }
            >
              Use Gumroad&apos;s direct-sale fee
            </button>
            <p className="text-mute mt-1 text-xs">
              10% + US$0.50 per direct sale (checked October 2026). In A$ we use A$0.80, a rounded
              estimate; check the conversion on your own payout. Card processing on top: not
              checked.
            </p>
          </fieldset>
        </Card>

        <Card>
          <details>
            <summary className="cursor-pointer text-lg font-semibold">
              An upsell <span className="text-mute font-normal">(optional)</span>
            </summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {field("upsellPrice", "Upsell price", { unit: sym })}
              {field("upsellTakePct", "Buyers who add it", { unit: "%" })}
              {field("upsellCost", "Its cost per order", { unit: sym })}
            </div>
          </details>
        </Card>

        <Card>
          <h2 className="text-2xl">
            An ad period <span className="text-mute text-base font-normal">(optional)</span>
          </h2>
          <p className="text-mute mt-1 text-sm">
            What you spent and the sales it brought, from your ads platform and your checkout.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {field("adSpend", "Ad spend", { unit: sym })}
            {field("orders", "Sales from ads", { step: "1" })}
            {field("conversionPct", "Visits that buy", {
              unit: "%",
              hint: "Optional. Sales ÷ product-page visits.",
            })}
          </div>
        </Card>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => setForm(DEFAULT_FORM)}>
            Reset to the example
          </Button>
        </div>
      </form>

      <section aria-labelledby="ads-results" className="space-y-6">
        <h2 id="ads-results" className="sr-only">
          Results
        </h2>
        {!result ? (
          <Notice tone="warning" title="Check the highlighted fields">
            The results appear once every number is valid.
          </Notice>
        ) : (
          <>
            <Card className="bg-blush-soft">
              <p className="eyebrow">Break-even cost per sale</p>
              <p className="font-num text-aubergine mt-2 text-5xl" aria-live="polite">
                {money(result.breakEven.cac)}
              </p>
              <p className="text-mute mt-2 text-sm">
                The most you can spend on ads to win one sale without losing money on it.{" "}
                {FORMULAS.breakEvenCac}.
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <Figure
                  label="Break-even ROAS"
                  value={formatRatio(result.breakEven.roas)}
                  note={FORMULAS.breakEvenRoas}
                />
                <Figure
                  label="Contribution per order"
                  value={money(result.perOrder.contribution)}
                  note={FORMULAS.contribution}
                />
                <Figure label="Customer pays" value={money(result.perOrder.customerPays)} />
                <Figure label="Fees per order" value={money(result.perOrder.fees)} />
                {result.perOrder.gst > 0 ? (
                  <Figure label="GST or VAT in that" value={money(result.perOrder.gst)} />
                ) : null}
                {result.breakEven.costPerVisit !== null ? (
                  <Figure
                    label="Most you can pay per visit"
                    value={money(result.breakEven.costPerVisit)}
                    note={FORMULAS.costPerVisit}
                  />
                ) : null}
              </dl>
            </Card>

            {result.ads.spend > 0 || result.ads.orders > 0 ? (
              <Card>
                <h3 className="text-xl">This ad period</h3>
                <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <Figure label="Cost per sale" value={money(result.ads.cac)} note={FORMULAS.cac} />
                  <Figure label="ROAS" value={formatRatio(result.ads.roas)} note={FORMULAS.roas} />
                  <Figure
                    label="After ads"
                    value={money(result.ads.contributionAfterAds)}
                    note={FORMULAS.contributionAfterAds}
                  />
                  <Figure
                    label="Sales this spend needed"
                    value={
                      result.ads.ordersToBreakEven === null
                        ? "Not defined"
                        : String(result.ads.ordersToBreakEven)
                    }
                  />
                </dl>
              </Card>
            ) : null}

            <div className="space-y-3">
              {readings.map((r) => (
                <Notice key={r.title} tone={r.tone} title={r.title}>
                  {r.text}
                </Notice>
              ))}
              {result.notes
                .filter((n) => !n.startsWith("Each order loses money"))
                .map((n) => (
                  <p key={n} className="text-mute text-sm">
                    {n}
                  </p>
                ))}
            </div>

            {result.breakEven.spendByOrders.length > 0 ? (
              <Card>
                <h3 className="text-xl">Break-even ad spend by number of sales</h3>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-mute text-left">
                      <th scope="col" className="py-1 font-semibold">
                        Sales
                      </th>
                      <th scope="col" className="py-1 font-semibold">
                        Most you can spend in total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.breakEven.spendByOrders.map((s) => (
                      <tr key={s.orders} className="border-line border-t">
                        <td className="font-num py-1.5">{s.orders}</td>
                        <td className="font-num py-1.5">{money(s.spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ) : null}

            <div className="no-print flex flex-wrap gap-3">
              <Button type="button" onClick={download}>
                Download as CSV
              </Button>
              <Button type="button" variant="secondary" onClick={() => window.print()}>
                Print or save as PDF
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-mute">{label}</dt>
      <dd className="font-num text-charcoal text-xl">{value}</dd>
      {note ? <dd className="text-mute mt-0.5 text-xs">{note}</dd> : null}
    </div>
  );
}
