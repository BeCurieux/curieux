// Prints the same tenancy fixtures as seed.ts, as one SQL script.
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

import { CHILDREN, FAMILIES, ORGS, USERS, type SeedUser } from "./fixtures";

const password = process.env.DEMO_PASSWORD;
if (!password || password.length < 12) {
  throw new Error("Set DEMO_PASSWORD (at least 12 characters).");
}

const q = (value: string) => `'${value.replaceAll("'", "''")}'`;

const lines: string[] = ["begin;"];

for (const org of Object.values(ORGS)) {
  lines.push(
    `insert into public.organisations (id, name, slug, activity_type) values (${q(org.id)}, ${q(org.name)}, ${q(org.slug)}, ${q(org.activity_type)})`,
    `  on conflict (id) do update set name = excluded.name, slug = excluded.slug, activity_type = excluded.activity_type;`,
  );
}
for (const family of Object.values(FAMILIES)) {
  lines.push(
    `insert into public.families (id, display_name) values (${q(family.id)}, ${q(family.display_name)})`,
    `  on conflict (id) do update set display_name = excluded.display_name;`,
  );
}
for (const child of Object.values(CHILDREN)) {
  lines.push(
    `insert into public.children (id, family_id, first_name, last_name, date_of_birth) values (${q(child.id)}, ${q(child.family_id)}, ${q(child.first_name)}, ${q(child.last_name)}, ${q(child.date_of_birth)})`,
    `  on conflict (id) do update set first_name = excluded.first_name, last_name = excluded.last_name, date_of_birth = excluded.date_of_birth;`,
  );
}

for (const user of Object.values(USERS) as SeedUser[]) {
  const membership = user.staff
    ? `insert into public.staff_memberships (user_id, organisation_id, role, status)
    values (profile_id, ${q(ORGS[user.staff.org].id)}, ${q(user.staff.role)}, 'active')
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

lines.push("commit;");
process.stdout.write(lines.join("\n") + "\n");
