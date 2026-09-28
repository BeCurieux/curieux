import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireShell } from "@/lib/auth/viewer";

export const metadata: Metadata = { title: "Teaching" };

export default async function InstructorHome() {
  const viewer = await requireShell("instructor");
  const teaching = viewer.staff.filter((s) => s.role === "instructor");

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-muted">
          {teaching.map((s) => s.organisationName).join(" · ")}
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Hi {viewer.name.split(" ")[0] || "there"}
        </h1>
      </div>
      <Card className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Your classes today</h2>
        <p className="text-muted">
          When you&apos;re assigned classes, they&apos;ll be here with attendance one tap away.
        </p>
      </Card>
    </>
  );
}
