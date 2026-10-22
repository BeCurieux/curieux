import { labelFor } from "@/lib/export/markdown";

// Read-only rendering of an output, for the printable pack.
export function ReadOnly({
  value,
  name = "",
  depth = 0,
}: {
  value: unknown;
  name?: string;
  depth?: number;
}) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number") {
    return name === "prompt" ? (
      <pre className="bg-blush-soft rounded-xl p-3 font-mono text-sm whitespace-pre-wrap">
        {String(value)}
      </pre>
    ) : (
      <p className="whitespace-pre-line">{String(value)}</p>
    );
  }
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v !== "object")) {
      return (
        <ul className="list-disc space-y-1 pl-5">
          {value.map((v, i) => (
            <li key={i}>{String(v)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="space-y-4">
        {value.map((item, i) => (
          <div key={i} className="border-blush break-inside-avoid border-l-2 pl-4">
            <ReadOnly value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <dl className="space-y-3">
      {Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "key")
        .map(([key, v]) => (
          <div key={key}>
            <dt className="text-oxblood text-sm font-semibold">{labelFor(key)}</dt>
            <dd className="mt-1">
              <ReadOnly value={v} name={key} depth={depth + 1} />
            </dd>
          </div>
        ))}
    </dl>
  );
}
