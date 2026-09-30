// Prints the same fixtures as seed.ts, as one SQL script.
//
// seed.ts needs the project's secret key and talks to the Auth admin API.
// This is for a hosted project where only SQL access is available: it writes
// the Auth rows directly, the way Supabase's own dashboard examples do, and
// the sign-up trigger creates each profile as usual. Safe to run repeatedly.
//
// The password comes from DEMO_PASSWORD and is never written to the repo.
// Every account is fictional; run this only against a demo project.
//
//   DEMO_PASSWORD=... npx tsx scripts/seed-sql.ts > /tmp/demo-seed.sql

import {
  FAMILIES,
  ORGS,
  USERS,
  classRows,
  DEMO_ABSENCES,
  PAST_MAKEUPS,
  enrolmentRows,
  expiringCreditRows,
  pastLessonRows,
  seedRows,
  type SeedUser,
} from "./fixtures";

const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) {
  throw new Error("Set DEMO_PASSWORD (at least 12 characters).");
}

const q = (value: string) => `'${value.replaceAll("'", "''")}'`;

function literal(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") return q(JSON.stringify(value));
  return q(String(value));
}

// insert … on conflict do update, for a batch of rows sharing one shape.
function upsert(table: string, conflict: string, rows: Record<string, unknown>[]): string[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]!);
  const updates = columns
    .filter((c) => !conflict.split(",").includes(c))
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  return [
    `insert into public.${table} (${columns.join(", ")}) values`,
    rows.map((r) => `  (${columns.map((c) => literal(r[c])).join(", ")})`).join(",\n"),
    `  on conflict (${conflict}) do update set ${updates};`,
  ];
}

const lines: string[] = ["begin;"];

for (const { table, conflict, rows } of seedRows()) lines.push(...upsert(table, conflict, rows));

for (const user of Object.values(USERS) as SeedUser[]) {
  const membership = user.staff
    ? `insert into public.staff_memberships (id, user_id, organisation_id, role, status)
    values (${q(user.staff.membershipId)}, profile_id, ${q(ORGS[user.staff.org].id)}, ${q(user.staff.role)}, 'active')
    on conflict (user_id, organisation_id) do update set role = excluded.role, status = 'active';`
    : "";
  const family = user.family
    ? `insert into public.family_members (user_id, family_id, relationship, is_primary_guardian)
    values (profile_id, ${q(FAMILIES[user.family.family].id)}, ${q(user.family.relationship)}, ${user.family.primary})
    on conflict (family_id, user_id) do update set relationship = excluded.relationship, is_primary_guardian = excluded.is_primary_guardian;`
    : "";

  lines.push(`do $$
declare
  auth_user_id uuid;
  profile_id uuid;
begin
  select id into auth_user_id from auth.users where email = ${q(user.email)};
  if auth_user_id is null then
    auth_user_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', auth_user_id, 'authenticated', 'authenticated',
      ${q(user.email)}, extensions.crypt(${q(password)}, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('name', ${q(user.name)}), now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), auth_user_id, auth_user_id::text,
      jsonb_build_object('sub', auth_user_id::text, 'email', ${q(user.email)}, 'email_verified', true),
      'email', now(), now(), now()
    );
  else
    update auth.users
      set encrypted_password = extensions.crypt(${q(password)}, extensions.gen_salt('bf')), updated_at = now()
      where id = auth_user_id;
  end if;

  update public.users set name = ${q(user.name)}, email = ${q(user.email)}
    where auth_id = auth_user_id
    returning id into profile_id;

  ${membership}
  ${family}
end $$;`);
}

// Classes need their instructors' memberships, and enrolments need both.
lines.push(...upsert("classes", "id", classRows()));
lines.push(...upsert("enrolments", "id", enrolmentRows()));
for (const r of pastLessonRows()) {
  lines.push(
    `insert into public.class_occurrences (organisation_id, class_id, starts_at, ends_at)
  values (${q(r.organisation_id)}, ${q(r.class_id)}, ${q(r.starts_at)}, ${q(r.ends_at)})
  on conflict (class_id, starts_at) do nothing;`,
  );
}

// The demo's absences, on each class's next lesson.
for (const a of DEMO_ABSENCES) {
  const next = `(select id from public.class_occurrences where class_id = ${q(a.class.id)}
    and status = 'scheduled' and starts_at > now() order by starts_at limit 1)`;
  lines.push(
    `insert into public.absences (id, organisation_id, child_id, occurrence_id, make_up_eligible)
  values (${q(a.id)}, ${q(a.class.organisation_id)}, ${q(a.child)}, ${next}, true)
  on conflict (id) do update set occurrence_id = excluded.occurrence_id;`,
    `insert into public.makeup_credits (id, organisation_id, child_id, source_occurrence_id, source_absence_id, reason, expires_at, status)
  values (${q(a.creditId)}, ${q(a.class.organisation_id)}, ${q(a.child)}, ${next}, ${q(a.id)}, 'absence', now() + interval '60 days', 'available')
  on conflict (id) do update set source_occurrence_id = excluded.source_occurrence_id, expires_at = excluded.expires_at, status = 'available';`,
  );
}
lines.push(...upsert("makeup_credits", "id", expiringCreditRows()));

// Last week's make-ups, into each target class's most recent lesson.
for (const m of PAST_MAKEUPS) {
  const last = `(select id from public.class_occurrences where class_id = ${q(m.class.id)}
    and starts_at < now() order by starts_at desc limit 1)`;
  lines.push(
    `insert into public.makeup_credits (id, organisation_id, child_id, reason, issued_at, expires_at, status)
  values (${q(m.creditId)}, ${q(m.class.organisation_id)}, ${q(m.child)}, 'absence', now() - interval '20 days', now() + interval '40 days', 'redeemed')
  on conflict (id) do nothing;`,
    `insert into public.makeup_bookings (id, organisation_id, credit_id, child_id, target_occurrence_id, status, booked_at)
  values (${q(m.bookingId)}, ${q(m.class.organisation_id)}, ${q(m.creditId)}, ${q(m.child)}, ${last}, 'completed', now() - interval '12 days')
  on conflict (id) do update set target_occurrence_id = excluded.target_occurrence_id;`,
  );
}

lines.push("commit;");
process.stdout.write(lines.join("\n") + "\n");
