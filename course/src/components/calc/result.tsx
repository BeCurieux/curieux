import { formatOutput, type Currency } from "@/lib/calc/format";
import type { Colour, OutputSpec, OutputTable, Outputs } from "@/lib/calc/types";

// A calculator's result: the plain sentence, the numbers, any table. Used
// live in the form and for saved runs, in the browser or on the server.

const BADGE: Record<Colour, string> = {
  green: "bg-[#e3efe7] text-[#1f5136]",
  amber: "bg-[#f6ead2] text-[#6b4510]",
  red: "bg-danger-soft text-danger",
};

export function ColourBadge({ colour }: { colour: Colour }) {
  const label = { green: "Green", amber: "Amber", red: "Red" }[colour];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${BADGE[colour]}`}
    >
      <span aria-hidden className="size-2.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function Value({
  spec,
  value,
  currency,
}: {
  spec: OutputSpec;
  value: unknown;
  currency: Currency;
}) {
  if (spec.kind === "colour" && typeof value === "string")
    return <ColourBadge colour={value as Colour} />;
  return <>{formatOutput(spec.kind, value, currency)}</>;
}

export function Result({
  outputs,
  specs,
  tables = [],
  sentence,
  currency,
}: {
  outputs: Outputs;
  specs: OutputSpec[];
  tables?: OutputTable[];
  sentence: string | null;
  currency: Currency;
}) {
  return (
    <div data-testid="result">
      {sentence ? <p className="text-accent text-xl font-semibold">{sentence}</p> : null}
      {specs.length ? (
        <dl className="divide-line border-line bg-paper mt-4 divide-y rounded-2xl border">
          {specs.map((spec) => (
            <div key={spec.key} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <dt>
                {spec.label}
                {spec.help ? <span className="text-mute block text-base">{spec.help}</span> : null}
              </dt>
              <dd className="shrink-0 text-right text-lg font-semibold" data-output={spec.key}>
                <Value spec={spec} value={outputs[spec.key]} currency={currency} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {tables.map((table) => {
        const rows = (outputs[table.key] as Outputs[] | undefined) ?? [];
        return (
          <div
            key={table.key}
            className="border-line bg-paper mt-4 overflow-x-auto rounded-2xl border"
          >
            <table className="w-full text-left">
              <caption className="px-4 pt-3 text-left font-semibold">{table.label}</caption>
              <thead>
                <tr className="text-mute">
                  {table.columns.map((c) => (
                    <th key={c.key} scope="col" className="px-4 py-2 font-medium">
                      {c.label || <span className="sr-only">Status</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="border-line border-t">
                    {table.columns.map((c) => (
                      <td key={c.key} className="px-4 py-2">
                        <Value spec={c} value={row[c.key]} currency={currency} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
