import type { ComponentProps } from "react";

export function Card({ className = "", ...props }: ComponentProps<"section">) {
  // A background passed in replaces the default rather than fighting it.
  const background = /(^|\s)bg-/.test(className) ? "" : "bg-paper";
  return (
    <section
      className={`border-line rounded-3xl border ${background} p-5 shadow-[0_1px_0_rgba(40,37,40,0.04)] sm:p-7 ${className}`}
      {...props}
    />
  );
}

export function Badge({
  tone = "blush",
  className = "",
  ...props
}: ComponentProps<"span"> & { tone?: "blush" | "ink" | "success" | "warning" | "outline" }) {
  const tones = {
    blush: "bg-blush text-ink",
    ink: "bg-ink text-ivory",
    success: "bg-[#e3efe7] text-success",
    warning: "bg-[#f6ead2] text-warning",
    outline: "border border-line text-ink-soft",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-8 max-w-3xl">
      {eyebrow ? <p className="eyebrow mb-3">{eyebrow}</p> : null}
      <h1 className="text-4xl sm:text-5xl">{title}</h1>
      {children ? <div className="text-ink-soft mt-4 text-lg">{children}</div> : null}
    </header>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warning" | "success" | "danger";
  title?: string;
  children: React.ReactNode;
}) {
  const tones = {
    info: "border-line bg-blush-soft",
    warning: "border-[#e3c98f] bg-[#fbf3e2]",
    success: "border-[#b9d6c3] bg-[#eef6f0]",
    danger: "border-[#e2b4b4] bg-[#fbeeee]",
  };
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`rounded-2xl border p-4 text-sm ${tones[tone]}`}
    >
      {title ? <p className="text-ink mb-1 font-semibold">{title}</p> : null}
      <div className="text-ink">{children}</div>
    </div>
  );
}
