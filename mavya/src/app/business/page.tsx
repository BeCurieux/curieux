import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireShell } from "@/lib/auth/viewer";

export const metadata: Metadata = { title: "Business" };

export default async function BusinessHome() {
  const viewer = await requireShell("business");
  const owned = viewer.staff.filter((s) => s.role === "owner");

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-base font-semibold text-muted">Hi {firstName(viewer.name)}</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {owned.map((s) => s.organisationName).join(" · ")}
        </h1>
      </div>
      <Card className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Today</h2>
        <p className="text-muted">
          Classes, families and open spots will show up here once your timetable is in Mavya.
        </p>
      </Card>
    </>
  );
}

function firstName(name: string) {
  return name.split(" ")[0] || "there";
}
