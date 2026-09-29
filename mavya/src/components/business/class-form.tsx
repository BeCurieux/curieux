"use client";

import { ActionForm } from "@/components/forms/action-form";
import { SelectField, TextField } from "@/components/forms/field";
import { saveClass } from "@/lib/business/actions";
import type { ClassSummary, Instructor, Location, Program } from "@/lib/domain/timetable";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function ClassForm({
  klass,
  locations,
  programs,
  instructors,
}: {
  klass?: ClassSummary;
  locations: Location[];
  programs: Program[];
  instructors: Instructor[];
}) {
  return (
    <ActionForm
      action={saveClass.bind(null, klass?.id ?? null)}
      submitLabel={klass ? "Save class" : "Create class"}
    >
      <TextField
        name="name"
        label="Class name"
        hint="What families and staff will see, e.g. Dolphin 3."
        defaultValue={klass?.name}
      />
      <SelectField
        name="levelId"
        label="Level"
        placeholder="Choose a level"
        defaultValue={klass?.levelId}
        options={programs.flatMap((p) =>
          p.levels.map((l) => ({ value: l.id, label: l.name, group: p.name })),
        )}
      />
      <SelectField
        name="locationId"
        label="Location"
        placeholder="Choose a location"
        defaultValue={klass?.locationId}
        options={locations.filter((l) => l.active).map((l) => ({ value: l.id, label: l.name }))}
      />
      <SelectField
        name="instructorId"
        label="Instructor"
        optional
        placeholder="No one yet"
        defaultValue={klass?.instructorId}
        options={instructors.map((i) => ({ value: i.membershipId, label: i.name }))}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          name="weekday"
          label="Day"
          placeholder="Choose a day"
          defaultValue={klass?.weekday}
          options={DAYS.map((d, i) => ({ value: String(i + 1), label: d }))}
        />
        <TextField
          name="startTime"
          label="Start time"
          type="time"
          defaultValue={klass?.startTime}
        />
        <TextField
          name="durationMinutes"
          label="Length (minutes)"
          type="number"
          inputMode="numeric"
          min={5}
          max={480}
          defaultValue={klass?.durationMinutes ?? 30}
        />
        <TextField
          name="capacity"
          label="Places"
          type="number"
          inputMode="numeric"
          min={1}
          max={200}
          defaultValue={klass?.capacity ?? 10}
        />
      </div>
      {klass ? (
        <p className="text-sm text-muted">
          Changing the day, time or length reschedules this class&apos;s upcoming lessons.
        </p>
      ) : (
        <p className="text-sm text-muted">
          We&apos;ll schedule the next 12 weeks of lessons for you.
        </p>
      )}
    </ActionForm>
  );
}
