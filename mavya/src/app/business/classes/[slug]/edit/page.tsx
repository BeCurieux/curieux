import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClassForm } from "@/components/business/class-form";
import { BackLink } from "@/components/demo/back-link";
import { Button } from "@/components/ui/button";
import { setClassActive } from "@/lib/business/actions";
import { requireOwner } from "@/lib/business/owner";
import { classSlug, resolveClassId } from "@/lib/demo/service";
import { getClass, listInstructors, listLocations, listPrograms } from "@/lib/domain/timetable";

export const metadata: Metadata = { title: "Edit class" };

export default async function EditClassPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db, organisationId } = await requireOwner();
  const klass = await getClass(db, resolveClassId(slug));
  if (!klass) notFound();
  const [locations, programs, instructors] = await Promise.all([
    listLocations(db),
    listPrograms(db),
    listInstructors(db, organisationId),
  ]);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <BackLink href={`/business/classes/${classSlug(klass.id)}`}>{klass.name}</BackLink>
      <h1 className="font-display text-4xl font-semibold tracking-tight">Edit {klass.name}</h1>
      <ClassForm
        klass={klass}
        locations={locations}
        programs={programs}
        instructors={instructors}
      />
      <form
        action={setClassActive.bind(null, klass.id, !klass.active)}
        className="border-t border-line pt-6"
      >
        <p className="mb-3 text-muted">
          {klass.active
            ? "Stop running this class. Its upcoming lessons are removed; enrolled children stay on record."
            : "This class isn't running. Start it again to schedule its lessons."}
        </p>
        <Button type="submit" variant="soft">
          {klass.active ? "Stop running this class" : "Start running this class"}
        </Button>
      </form>
    </div>
  );
}
