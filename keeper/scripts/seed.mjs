// Seed a fictional development family (brief §32).
// Florence, age 2 — Bun Bun the blue rabbit, yellow rain boots, strawberries,
// garbage trucks, swimming, "I do it", exactly three bedtime songs.
// ~40 mock memories spanning one year. No real child data anywhere.
//
// Usage: SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... npm run seed

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const SEED_EMAIL = "demo@keeper.test";
const SEED_PASSWORD = "keeper-demo-password";

// Florence turned 2 a year ago; the book year is age 2→3.
const today = new Date();
const dob = new Date(today.getFullYear() - 3, 3, 14); // ~3 years old now
const yearStart = new Date(dob); yearStart.setFullYear(dob.getFullYear() + 2);

function day(offsetDays) {
  const d = new Date(yearStart);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

// [dayOffset, type, text, tags, people]
const MEMORIES = [
  [3,   "text",  "First morning as a two-year-old. Insisted on wearing the yellow boots to breakfast.", ["yellow_boots"], []],
  [9,   "photo", "Florence in the garden holding Bun Bun by one ear.", ["bun_bun", "garden"], []],
  [15,  "quote", "I do it!", ["phrase"], []],
  [21,  "photo", "Watching the garbage truck from the front window, completely still.", ["garbage_trucks", "ordinary_day"], []],
  [27,  "photo", "Strawberries for morning tea. Most of them made it into her mouth.", ["strawberries"], []],
  [33,  "photo", "Swimming lesson. Held the edge the whole time.", ["swimming"], []],
  [40,  "photo", "Grandma reading the duck book for the fourth time in a row.", ["grandma", "books"], ["Grandma"]],
  [46,  "photo", "Asleep in the pram, Bun Bun tucked under her chin.", ["bun_bun"], []],
  [52,  "quote", "Bun Bun tired now.", ["bun_bun", "quote"], []],
  [58,  "photo", "Puddle inspection in the yellow boots after the rain.", ["yellow_boots", "ordinary_day"], []],
  [64,  "photo", "Thursday at Grandpa's. They watered every single pot plant.", ["grandpa", "grandpa_thursdays"], ["Grandpa"]],
  [70,  "photo", "Swimming again — this time she let go of the edge.", ["swimming"], []],
  [77,  "text",  "She lined up all her animals to watch the garbage truck. Bun Bun got the best spot.", ["garbage_trucks", "bun_bun"], []],
  [84,  "photo", "Picking strawberries at the farm with Mum.", ["strawberries", "trip"], ["Mum"]],
  [91,  "quote", "More songs. Three songs!", ["bedtime", "quote"], []],
  [98,  "photo", "Beach morning. The bucket was for shells; the shells were for Bun Bun.", ["beach", "bun_bun", "trip"], []],
  [105, "photo", "Beach again — chasing the water back and forth for an hour.", ["beach", "trip"], []],
  [112, "photo", "Beach picnic, third day straight. Sandy strawberries.", ["beach", "strawberries", "trip"], []],
  [119, "photo", "Thursday at Grandpa's again. Same routine: pots, then biscuits.", ["grandpa", "grandpa_thursdays"], ["Grandpa"]],
  [126, "photo", "New swimming pool. She asked to go 'under under'.", ["swimming"], []],
  [133, "quote", "I do it my byself.", ["phrase", "quote"], []],
  [140, "photo", "Dad and Florence building a garbage truck from blocks.", ["garbage_trucks"], ["Dad"]],
  [147, "photo", "Yellow boots, no rain in sight. Non-negotiable.", ["yellow_boots"], []],
  [154, "text",  "Bedtime is exactly three songs now. Not two. Not four. Three.", ["bedtime"], []],
  [161, "photo", "Grandma's birthday lunch. Florence blew out the candles for her.", ["grandma"], ["Grandma"]],
  [168, "photo", "Swimming lesson — jumped in by herself for the first time, according to her teacher.", ["swimming"], []],
  [175, "photo", "Asleep holding one strawberry. Refused to eat the last one.", ["strawberries"], []],
  [182, "quote", "Garbage truck says bye bye.", ["garbage_trucks", "quote"], []],
  [189, "photo", "Half-birthday pancakes. Bun Bun had his own plate.", ["bun_bun"], []],
  [196, "photo", "Thursday at Grandpa's: first time she 'drove' the mower (stationary).", ["grandpa", "grandpa_thursdays"], ["Grandpa"]],
  [203, "photo", "Rainy day fort with Mum. Bun Bun was the doorbell.", ["bun_bun", "ordinary_day"], ["Mum"]],
  [210, "photo", "Yellow boots at the museum. Security guard approved.", ["yellow_boots", "trip"], []],
  [217, "text",  "She now narrates the garbage truck's whole route to anyone who will listen.", ["garbage_trucks"], []],
  [224, "photo", "Swimming with Dad — 'under under' achieved, twice.", ["swimming"], ["Dad"]],
  [231, "quote", "Three songs, then one more three songs.", ["bedtime", "quote"], []],
  [238, "photo", "Strawberry-picking round two. She 'checked' every berry personally.", ["strawberries", "trip"], []],
  [245, "photo", "Ordinary Tuesday: boots, Bun Bun, footpath, one hour.", ["ordinary_day", "yellow_boots", "bun_bun"], []],
  [252, "photo", "Grandpa taught her to whistle. It's more of a hiss, but she's committed.", ["grandpa"], ["Grandpa"]],
  [259, "photo", "Last swimming lesson of the term — swam a metre to Mum.", ["swimming"], ["Mum"]],
  [266, "text",  "She told the checkout lady, very seriously: 'I do it my byself.'", ["phrase"], []],
  [273, "photo", "Bun Bun went through the wash. Emotional afternoon; happy reunion.", ["bun_bun"], []],
  [280, "photo", "An ordinary morning: boots on the wrong feet, refused all help.", ["ordinary_day", "yellow_boots", "phrase"], []],
];

const LITTLE_THINGS = [
  ["current_obsession", "garbage trucks — knows the whole Tuesday route"],
  ["comfort_object", "Bun Bun, a blue rabbit, goes everywhere"],
  ["favourite_food", "strawberries, checked personally before eating"],
  ["funny_word", "'my byself'"],
  ["bedtime_ritual", "exactly three songs, counted on fingers"],
  ["favourite_person", "Grandpa on Thursdays"],
  ["phrase", "I do it!"],
];

async function main() {
  // 1. Demo user
  let userId;
  const { data: created, error: userErr } = await db.auth.admin.createUser({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    email_confirm: true,
  });
  if (userErr) {
    const { data: list } = await db.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === SEED_EMAIL);
    if (!existing) throw userErr;
    userId = existing.id;
    console.log("Using existing demo user");
  } else {
    userId = created.user.id;
    console.log("Created demo user", SEED_EMAIL);
  }

  // Re-seed cleanly: drop any previous demo family.
  const { data: oldFamilies } = await db.from("families").select("id").eq("owner_user_id", userId);
  for (const f of oldFamilies ?? []) await db.from("families").delete().eq("id", f.id);

  // 2. Family + people
  const { data: family } = await db
    .from("families")
    .insert({ owner_user_id: userId, family_name: "Demo family" })
    .select("id").single();

  const memberRows = [
    ["Sarah", "Mum", null],
    ["James", "Dad", null],
    ["Margaret", "Grandma", "Grandma"],
    ["Tom", "Grandpa", "Grandpa"],
  ];
  const memberIdByNickname = {};
  for (const [name, relationship, nickname] of memberRows) {
    const { data: m } = await db
      .from("family_members")
      .insert({ family_id: family.id, name, relationship, nickname_used_by_child: nickname })
      .select("id").single();
    memberIdByNickname[relationship] = m.id;
  }

  // 3. Florence
  const { data: child } = await db
    .from("children")
    .insert({
      family_id: family.id,
      first_name: "Florence",
      date_of_birth: dob.toISOString().slice(0, 10),
      pronouns: "she/her",
    })
    .select("id").single();
  console.log("Created Florence", child.id);

  // 4. Memories
  let count = 0;
  for (const [offset, type, text, tags, people] of MEMORIES) {
    const { data: memory } = await db
      .from("memories")
      .insert({
        child_id: child.id,
        created_by: userId,
        type,
        raw_text: text,
        memory_date: day(offset),
      })
      .select("id").single();
    for (const tag of tags) {
      await db.from("memory_tags").insert({ memory_id: memory.id, tag, source: "parent" });
    }
    for (const person of people) {
      const memberId = memberIdByNickname[person];
      if (memberId) {
        await db.from("memory_people").insert({ memory_id: memory.id, family_member_id: memberId });
      }
    }
    count++;
  }
  console.log(`Created ${count} memories`);

  // 5. Little things
  for (const [category, value] of LITTLE_THINGS) {
    await db.from("little_things").insert({
      child_id: child.id,
      category,
      value,
      recorded_date: day(120),
    });
  }
  console.log(`Created ${LITTLE_THINGS.length} little things`);

  // 6. Queue the AI pipeline so clusters/questions appear after `npm run jobs`.
  await db.from("jobs").insert({
    type: "analyse_memories",
    payload: { child_id: child.id },
    idempotency_key: `seed-analyse-${child.id}`,
  });

  console.log(`\nDone. Log in as ${SEED_EMAIL} / ${SEED_PASSWORD}`);
  console.log("Run `npm run jobs` to process analysis → clusters → questions.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
