// Makes an existing account an admin: `npm run admin:add -- you@example.com`
//
// She must have signed in once first (that creates the account). Reads
// NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY from the environment or
// .env.local. To add an admin on production, run it with production's
// values in the environment, or run in the Supabase SQL editor:
//
//   insert into public.admins (user_id)
//   select id from auth.users where email = 'you@example.com'
//   on conflict (user_id) do nothing;

import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

if (!email || !email.includes("@")) {
  console.error("Usage: npm run admin:add -- you@example.com");
  process.exit(1);
}
if (!url || !key) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (or put them in .env.local).",
  );
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserId(target: string): Promise<string | undefined> {
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const match = data.users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 1000) return undefined;
  }
}

const userId = await findUserId(email);
if (!userId) {
  console.error(`No account for ${email}. Sign in once at /login, then run this again.`);
  process.exit(1);
}

const { error } = await supabase
  .from("admins")
  .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`${email} is an admin.`);
