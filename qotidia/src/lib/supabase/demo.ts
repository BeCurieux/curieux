// Demo mode — the whole product, no database.
//
// Set DEMO_MODE=1 and the app runs against an in-memory copy of the Florence
// fixture instead of Supabase. Nothing persists, everyone is signed in as the
// demo parent, and photographs are generated rather than stored.
//
// This exists so the interface can be walked end to end — by us, by a tester,
// by anyone judging the product — without provisioning anything. It is not a
// test double for the real client: it implements only the query shapes the
// pages actually use, and throws loudly on anything else so a page that grows
// a new query cannot silently render empty.

import { shiftDays, todayIso } from "@/lib/time";
import { periodFor } from "@/lib/book/period";

export const DEMO_USER = {
  id: "demo-user",
  email: "demo@qotidia.test",
  // A passkey and an app, so the security screens are walkable. The demo has
  // no auth server, so nothing here can actually be verified — it exists to
  // show the shape of the page, and step-up.ts reports the demo session as
  // already having proved itself rather than pretending a ceremony ran.
  factors: [
    {
      id: "demo-passkey",
      factor_type: "webauthn",
      status: "verified",
      friendly_name: "Passkey",
      created_at: "2026-01-04T00:00:00Z",
    },
    {
      id: "demo-totp",
      factor_type: "totp",
      status: "verified",
      friendly_name: "Authenticator app",
      created_at: "2026-02-11T00:00:00Z",
    },
  ],
};

type Row = Record<string, any>;

// ---------------------------------------------------------------- fixture

const SCENES = [
  ["#E8DCC6", "#C9B393", "#8E7659"], ["#CBD4C6", "#93A388", "#5C6B52"],
  ["#DCE4E7", "#C4CDD1", "#A9A491"], ["#B9A48C", "#8A7460", "#4E4034"],
  ["#BBCBCE", "#7E9BA1", "#3F5B62"], ["#DAD6CC", "#B3ADA1", "#78716A"],
];

/** Generated stand-in photograph. No real child's imagery, ever. */
export function demoPhoto(seed: number, w = 1600, h = 2100): string {
  const [a, b, c] = SCENES[seed % SCENES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0" stop-color="${a}"/><stop offset="0.55" stop-color="${b}"/>
        <stop offset="1" stop-color="${c}"/>
      </linearGradient>
      <radialGradient id="s" cx="${seed % 2 ? 0.58 : 0.42}" cy="0.44" r="0.36">
        <stop offset="0" stop-color="#fff" stop-opacity="0.4"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <rect width="100%" height="100%" fill="url(#s)"/>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const MEMORY_SEED: [number, string, string, string[]][] = [
  [3, "text", "First morning as a two-year-old. Insisted on wearing the yellow boots to breakfast.", ["yellow_boots"]],
  [9, "photo", "Florence in the garden holding Bun Bun by one ear.", ["bun_bun"]],
  [15, "quote", "I do it!", ["phrase"]],
  [21, "photo", "Watching the garbage truck from the front window, completely still.", ["garbage_trucks", "ordinary_day"]],
  [27, "photo", "Strawberries for morning tea.", ["strawberries"]],
  [33, "photo", "Swimming lesson. Held the edge the whole time.", ["swimming"]],
  [40, "photo", "Grandma reading the duck book for the fourth time in a row.", ["grandma"]],
  [46, "photo", "Asleep in the pram, Bun Bun tucked under her chin.", ["bun_bun"]],
  [52, "quote", "Bun Bun tired now.", ["bun_bun"]],
  [58, "photo", "Puddle inspection in the yellow boots after the rain.", ["yellow_boots"]],
  [64, "photo", "Thursday at Grandpa's. They watered every single pot plant.", ["grandpa"]],
  [70, "photo", "Swimming again — this time she let go of the edge.", ["swimming"]],
  [84, "photo", "Picking strawberries at the farm with Mum.", ["strawberries"]],
  [98, "photo", "Beach morning. The bucket was for shells; the shells were for Bun Bun.", ["beach"]],
  [105, "photo", "Beach again — chasing the water back and forth for an hour.", ["beach"]],
  [112, "photo", "Last morning at the beach. Would not put shoes on.", ["beach"]],
  [119, "photo", "Thursday at Grandpa's again. Same routine: pots, then biscuits.", ["grandpa"]],
  [126, "photo", "New swimming pool. She asked to go 'under under'.", ["swimming"]],
  [133, "quote", "I do it my byself.", ["phrase"]],
  [140, "quote", "I do it! I do it!", ["phrase"]],
  [147, "photo", "Yellow boots, no rain in sight. Non-negotiable.", ["yellow_boots"]],
  [161, "photo", "Grandma's birthday lunch.", ["grandma"]],
  [168, "photo", "Bun Bun in the trolley seat, seatbelt done up over him.", ["bun_bun"]],
  [182, "quote", "Garbage truck says bye bye.", ["garbage_trucks"]],
  [196, "photo", "Thursday at Grandpa's: first time she 'drove' the mower.", ["grandpa"]],
  [210, "photo", "Yellow boots at the museum.", ["yellow_boots"]],
  [231, "quote", "Three songs, then one more three songs.", ["bedtime"]],
  [245, "photo", "An ordinary Tuesday: boots, Bun Bun, footpath, one hour.", ["ordinary_day", "bun_bun"]],
  [259, "photo", "Last swimming lesson of the term — swam a metre to Mum.", ["swimming"]],
  [273, "photo", "Bun Bun went through the wash. Emotional afternoon.", ["bun_bun"]],
  [280, "photo", "An ordinary morning: boots on the wrong feet, refused all help.", ["ordinary_day"]],
];

function buildTables(): Record<string, Row[]> {
  // Anchored on the same "today" the product reasons about, not on the
  // server's UTC clock. Those two disagree for ten hours a day, and while
  // they did the fixture was silently a day out: the hat photographed four
  // times this week read as three, but only after 10am UTC.
  const today = todayIso();
  const start = shiftDays(today, -365);
  const day = (n: number) => shiftDays(start, n);

  // Florence is two, turning three — so the dashboard and her book agree.
  const dobIso = shiftDays(start, -730);

  // The book's period, from the same function the product uses. Written by
  // hand it drifted a day from what createBook would produce, and the story
  // picker duly offered to make a book that already existed.
  const florencesYear = periodFor(
    { display_name: "Florence", subject_type: "child", date_of_birth: dobIso },
    { today }
  );

  const familyId = "demo-family";
  const subjectId = "demo-subject";

  // Maggie is Margaret. She is in this fixture twice on purpose.
  //
  // It is the most ordinary duplicate a family archive collects: one parent
  // entered her mother as Margaret, the other entered her as Maggie, and the
  // child calls her Nanna. Two people, two spellings, one grandmother — and
  // nothing the product can work out on its own, because the two names never
  // appear in the same photograph. It is what the resolution question exists
  // for, and the demo should contain the thing it demonstrates.
  const members = [
    ["Sarah", "Mum"], ["James", "Dad"], ["Margaret", "Grandma"], ["Tom", "Grandpa"],
    ["Maggie", "Nanna"],
  ].map(([name, relationship], i) => ({
    id: `member-${i}`, family_id: familyId, name, relationship,
    nickname_used_by_child: relationship, created_at: day(0),
  }));

  const memories: Row[] = [];
  const tags: Row[] = [];
  const assets: Row[] = [];
  const people: Row[] = [];

  // The recent weeks. The seed above stops 85 days ago, which is a lapsed
  // family — a real state the product handles, and a useless one for showing
  // what the weekly note does. These give it something true to notice.
  //
  // Two of the hats are a month old on purpose. Four mentions and nothing
  // before them is a first appearance, not a surge, and the shape code says
  // so correctly; a fixture that wants to demonstrate a surge has to contain
  // one rather than rely on the sentence sounding right.
  const recently = (offsetDays: number) => shiftDays(today, -offsetDays);
  [
    [1, "the dinosaur hat", "Wore the dinosaur hat to the shops. Again."],
    [2, "the dinosaur hat", "Dinosaur hat at breakfast."],
    [4, "the dinosaur hat", "Would not take the hat off for the bath."],
    [6, "the dinosaur hat", "Hat, park, hat."],
    [30, "the dinosaur hat", "Wore the hat to the park. Twice around the pond."],
    [38, "the dinosaur hat", "The dinosaur hat, a present from Aunty Kate."],
  ].forEach(([offset, tag, text], i) => {
    const id = `mem-recent-${i}`;
    memories.push({
      id, family_id: familyId, created_by: DEMO_USER.id, type: "text",
      raw_text: text, transcript: null, location: null, metadata: {},
      memory_date: recently(offset as number), created_at: recently(offset as number),
      contribution_status: "approved", visibility: "family",
      reviewed_by: null, reviewed_at: null,
    });
    tags.push({ id: `tag-recent-${i}`, memory_id: id, tag, source: "parent" });
  });

  // Thursdays at Grandpa's, on actual Thursdays.
  //
  // The observation this exists to demonstrate — "Tom turns up most
  // Thursdays" — is arithmetic over weekdays, so a fixture whose Thursdays
  // are not Thursdays proves nothing and would have quietly shown the
  // fallback line instead. Photographs with almost nothing written about
  // them, on purpose: this is also the shape gap detection looks for, and
  // Wednesday at Grandpa's is exactly the thing nobody writes down because
  // everybody involved already knows it.
  const onWeekday = (iso: string, weekday: number) => {
    const d = new Date(Date.parse(`${iso}T00:00:00Z`)).getUTCDay();
    return shiftDays(iso, -((d - weekday + 7) % 7));
  };
  const THURSDAY = 4;
  [
    [40, null],
    [61, null],
    [82, "Thursday at Grandpa's. They watered every single pot plant."],
    [110, null],
    [145, null],
    [187, null],
  ].forEach(([offset, text], i) => {
    const id = `mem-thursday-${i}`;
    const date = onWeekday(day(offset as number), THURSDAY);
    memories.push({
      id, family_id: familyId, created_by: DEMO_USER.id, type: "photo",
      raw_text: text, transcript: null, location: null, metadata: {},
      memory_date: date, created_at: date,
      contribution_status: "approved", visibility: "family",
      reviewed_by: null, reviewed_at: null,
    });
    people.push({ memory_id: id, family_member_id: "member-3" });
    assets.push({
      id: `asset-thursday-${i}`, memory_id: id, storage_path: `demo/${40 + i}.png`,
      mime_type: "image/png", width: 1600, height: 2100,
      checksum: `demo-thursday-${i}`, processing_status: "complete",
      scan_verdict: "clean", scan_reason: null, scanned_by: "fixture",
      capture_timestamp: date, duration_seconds: null, thumbnail_path: null,
    });
  });

  // Grandma, who is Maggie under her other name. Four of her own, so both
  // halves of the duplicate clear the bar and the demo actually contains the
  // situation the who's-who page exists for.
  [
    [12, "Grandma took her to the duck pond and reported full compliance."],
    [38, "Grandma stayed for tea. Two puddings were negotiated."],
    [64, "Grandma's, while the car was in."],
    [88, "Grandma read the duck book four times without complaint."],
  ].forEach(([offset, text], i) => {
    const id = `mem-grandma-${i}`;
    const date = day(offset as number);
    memories.push({
      id, family_id: familyId, created_by: DEMO_USER.id, type: "text",
      raw_text: text, transcript: null, location: null, metadata: {},
      memory_date: date, created_at: date,
      contribution_status: "approved", visibility: "family",
      reviewed_by: null, reviewed_at: null,
    });
    people.push({ memory_id: id, family_member_id: "member-2" });
  });

  // Nanna, on days of her own. No photograph has both names on it, which is
  // exactly why the archive cannot resolve this by itself.
  [
    [17, "Nanna came for lunch and stayed until bath time."],
    [24, "Baking with Nanna. Most of it ended up on the floor."],
    [45, "Nanna's, after nursery."],
    [73, "Nanna brought the yellow boots back from the car."],
    [96, "A whole afternoon at Nanna's."],
  ].forEach(([offset, text], i) => {
    const id = `mem-nanna-${i}`;
    const date = day(offset as number);
    memories.push({
      id, family_id: familyId, created_by: DEMO_USER.id, type: "text",
      raw_text: text, transcript: null, location: null, metadata: {},
      memory_date: date, created_at: date,
      contribution_status: "approved", visibility: "family",
      reviewed_by: null, reviewed_at: null,
    });
    people.push({ memory_id: id, family_member_id: "member-4" });
  });

  // Nanna, going back before this year's book.
  //
  // An archive is deeper than the volume being made from it, and this is the
  // fixture that says so: fourteen more afternoons stretching back two and a
  // half years, none of them inside Florence's current book year. They are
  // what makes "Nanna & Me" a book rather than a chapter — a relationship
  // that has crossed years is the whole distinguishing claim, and a demo
  // that cannot show one is demonstrating the refusal instead of the thing.
  [
    [240, "Nanna at the school gate, in the rain, delighted about it."],
    [275, "Nanna taught her the card game with the made-up rules."],
    [310, "Two hours at Nanna's kitchen table with the good scissors."],
    [355, "Nanna's, the day the washing machine broke."],
    [400, "Nanna brought soup. Nobody had asked for soup."],
    [455, "Fell asleep on Nanna halfway through the film."],
    [500, "Nanna let her ice the whole cake herself. It showed."],
    [560, "Walked to the postbox with Nanna, very slowly."],
    [615, "Nanna's, sorting the button tin. An entire afternoon."],
    [680, "Nanna sang the song about the donkey again."],
    [730, "First sleepover at Nanna's. One phone call home."],
    [790, "Nanna in the garden, being told the names of everything."],
    [850, "Nanna's birthday. Florence made the card, mostly."],
    [905, "Nanna held her while she cried about the wrong cup."],
  ].forEach(([offset, text], i) => {
    const id = `mem-nanna-back-${i}`;
    const date = day(offset as number);
    memories.push({
      id, family_id: familyId, created_by: DEMO_USER.id, type: "text",
      raw_text: text, transcript: null, location: null, metadata: {},
      memory_date: date, created_at: date,
      contribution_status: "approved", visibility: "family",
      reviewed_by: null, reviewed_at: null,
    });
    people.push({ memory_id: id, family_member_id: "member-4" });
  });

  // Two arrivals the archive could not place. Both are photographs shared
  // from a phone with the EXIF stripped, which is the one case the inbox
  // exists for — everything else files itself and never appears there.
  [
    ["Found in the camera roll. No idea when.", "Photos"],
    ["From Dad's phone.", "Shared album"],
  ].forEach(([text, note], i) => {
    const id = `mem-inbox-${i}`;
    memories.push({
      id, family_id: familyId, created_by: DEMO_USER.id, type: "photo",
      raw_text: text, transcript: null, location: null, metadata: {},
      memory_date: null, created_at: recently(i + 1),
      contribution_status: "approved", visibility: "family",
      reviewed_by: null, reviewed_at: null,
      arrived_via: i === 0 ? "share" : "email", arrival_note: note, filed_at: null,
    });
  });

  // Last year's few. The seed above all falls inside the year being
  // collected, and a look-back needs something older than that — so without
  // these the demo shows the feature's empty state, which is honest for a
  // family in their first year and useless for showing what it does.
  //
  // One of them is dated exactly a year before today, so "a year ago today"
  // fires whenever the demo is opened rather than one day in six.
  const yearBefore = (offsetDays: number) => shiftDays(today, -365 + offsetDays);
  [
    [0, "quote", "Bun Bun tired now. Bun Bun go bed."],
    [-2, "text", "Slept through for the first time. We didn't."],
    [-19, "text", "First time she said her own name. It came out 'Florrie'."],
  ].forEach(([offset, type, text], i) => {
    memories.push({
      id: `mem-prior-${i}`, family_id: familyId, created_by: DEMO_USER.id,
      type, raw_text: text, transcript: null, location: null, metadata: {},
      memory_date: yearBefore(offset as number), created_at: yearBefore(offset as number),
      contribution_status: "approved", visibility: "family",
      reviewed_by: null, reviewed_at: null,
    });
  });
  MEMORY_SEED.forEach(([offset, type, text, tagList], i) => {
    const id = `mem-${i}`;
    // The last two are Grandpa's, and are waiting — so the review queue has
    // something in it and the dashboard shows the prompt.
    const fromGrandpa = i >= MEMORY_SEED.length - 2;
    memories.push({
      id, family_id: familyId,
      created_by: fromGrandpa ? "demo-grandpa" : DEMO_USER.id,
      type,
      raw_text: text, transcript: null, location: null, metadata: {},
      memory_date: day(offset), created_at: day(offset),
      contribution_status: fromGrandpa ? "pending" : "approved",
      // Spelled out because the fake client has no column defaults. The real
      // table defaults this to 'family'; the fixture left it undefined, so
      // every query filtering on visibility silently matched nothing and the
      // whole year of memories was invisible to the graph.
      visibility: "family",
      reviewed_by: null, reviewed_at: null,
    });
    tagList.forEach((tag, t) =>
      tags.push({ id: `tag-${i}-${t}`, memory_id: id, tag, source: "parent" }));
    if (type === "photo") {
      assets.push({
        id: `asset-${i}`, memory_id: id, storage_path: `demo/${i}.png`,
        // Not image/svg+xml, which real uploads are refused for — a fixture
        // carrying a type the product rejects reads as a bug in the product.
        mime_type: "image/png", width: 1600, height: 2100,
        checksum: `demo-${i}`, processing_status: "complete",
        // The demo's photographs are generated, so they are the one case
        // where "clean" is true without a scan having run.
        scan_verdict: "clean", scan_reason: null, scanned_by: "fixture",
        capture_timestamp: day(offset), duration_seconds: null, thumbnail_path: null,
      });
    }
  });

  const clusterDefs = [
    ["Bun Bun", "bun_bun", "confirmed"], ["Swimming", "swimming", "confirmed"],
    ["The yellow boots", "yellow_boots", "confirmed"], ["Grandpa Thursdays", "grandpa", "suggested"],
    ["Ordinary days", "ordinary_day", "suggested"],
  ] as const;
  const clusters: Row[] = [];
  const clusterMembers: Row[] = [];
  clusterDefs.forEach(([title, tag, status], i) => {
    const id = `cluster-${i}`;
    const ids = tags.filter((t) => t.tag === tag).map((t) => t.memory_id);
    clusters.push({
      id, subject_id: subjectId, title, summary: null,
      start_date: day(3), end_date: day(280), confidence: 0.8, status,
      created_at: day(0),
    });
    ids.forEach((mid) => clusterMembers.push({ cluster_id: id, memory_id: mid }));
  });

  const bookId = "demo-book";
  const sections = [
    ["opening", "This was you at two"], ["theme", "The year of Bun Bun"],
    ["quotes", "Things you said"], ["theme", "The yellow boots"],
    ["little_things", "The little things"], ["closing", "At the end of two"],
  ].map(([section_type, title], i) => ({
    id: `section-${i}`, book_id: bookId, position: i, section_type, title,
    summary: null, created_at: day(0),
  }));

  const photoMemories = memories.filter((m) => m.type === "photo");
  const quoteMemories = memories.filter((m) => m.type === "quote");
  const pages: Row[] = [];
  const blocks: Row[] = [];
  const addPage = (archetype: string, sectionIdx: number, bs: Row[]) => {
    const n = pages.length + 1;
    const id = `page-${n}`;
    pages.push({
      id, book_id: bookId, section_id: sections[sectionIdx].id, page_number: n,
      template_id: archetype, layout_json: {}, approved: false, created_at: day(0),
    });
    bs.forEach((b, i) =>
      blocks.push({ id: `block-${n}-${i}`, page_id: id, created_at: day(0), ...b }));
  };
  const src = (id: string) => [{ kind: "memory", id }];

  addPage("chapter_opener", 0, [
    { type: "label", content: "One", source_ids: [], ai_generated: false, parent_edited: false },
    { type: "heading", content: "This was you at two", source_ids: [], ai_generated: true, parent_edited: false },
    { type: "text", content: "You lived in the grey house with the broken gate. By June you had opinions about boots.", source_ids: src(memories[0].id), ai_generated: true, parent_edited: false },
  ]);
  photoMemories.slice(0, 3).forEach((m, i) =>
    addPage(i === 0 ? "hero_photograph" : "portrait_plus_story", 1, [
      { type: "photo", content: m.id, source_ids: src(m.id), ai_generated: false, parent_edited: false },
      ...(i === 0 ? [] : [{ type: "text", content: m.raw_text, source_ids: src(m.id), ai_generated: true, parent_edited: false }]),
    ]));
  quoteMemories.slice(0, 2).forEach((m) =>
    addPage("quote_page", 2, [
      { type: "quote", content: m.raw_text, source_ids: src(m.id), ai_generated: true, parent_edited: false },
      { type: "annotation", content: "Florence, 2 years", source_ids: [], ai_generated: false, parent_edited: false },
    ]));
  addPage("object_portrait", 3, [
    { type: "photo", content: photoMemories[9].id, source_ids: src(photoMemories[9].id), ai_generated: false, parent_edited: false },
    { type: "text", content: "For four months, only the yellow boots would do.", source_ids: src(photoMemories[9].id), ai_generated: true, parent_edited: false },
  ]);
  addPage("little_things", 4, [
    { type: "heading", content: "The little things", source_ids: [], ai_generated: false, parent_edited: false },
    { type: "text", content: "Currently eating: Strawberries. Constantly.", source_ids: [], ai_generated: false, parent_edited: false },
    { type: "text", content: "Currently carrying: Bun Bun.", source_ids: [], ai_generated: false, parent_edited: false },
  ]);
  addPage("closing_page", 5, [
    { type: "heading", content: "At the end of two", source_ids: [], ai_generated: false, parent_edited: false },
    { type: "text", content: "You are two and eleven months. You can nearly whistle.", source_ids: src(memories[27].id), ai_generated: true, parent_edited: false },
  ]);

  return {
    profiles: [
      { id: DEMO_USER.id, email: DEMO_USER.email, is_admin: true, subscription_status: "none", stripe_customer_id: null, created_at: day(0) },
      { id: "demo-grandpa", email: "grandpa@example.com", is_admin: false, subscription_status: "none", stripe_customer_id: null, created_at: day(30) },
    ],
    families: [{
      id: familyId, owner_user_id: DEMO_USER.id, family_name: "Demo family", created_at: day(0),
      // A monthly member eight months in: past the threshold, so this
      // year's book is included and the billing page shows the state that
      // most needs to read correctly.
      plan: "monthly", membership_state: "active",
      stripe_subscription_id: "sub_demo", paid_until: day(365),
      months_paid_total: 8, months_paid_this_year: 8,
    }],
    family_members: members,
    subjects: [{
      id: "demo-theo", family_id: familyId, subject_type: "child",
      display_name: "Theo", date_of_birth: shiftDays(start, -1830), pronouns: "he/him",
      cover_colour: null, created_at: day(1),
    }, {
      id: "demo-household", family_id: familyId, subject_type: "family",
      display_name: "The Wilsons", date_of_birth: null, pronouns: null,
      cover_colour: null, created_at: day(2),
    }, {
      id: subjectId, family_id: familyId, subject_type: "child",
      display_name: "Florence", date_of_birth: dobIso, pronouns: "she/her",
      // Null: the demo shelf shows the age spectrum, which is the default a
      // new family sees. Setting one here would show the exception as if it
      // were the rule.
      cover_colour: null,
      photo_path: null, created_at: day(0),
    }],
    memories, memory_tags: tags, media_assets: assets, memory_people: people,
    // Every memory in the fixture is about Florence. A second child would
    // have its own links, and the Cornwall morning would carry both.
    memory_subjects: memories.flatMap((m, i) => {
      // Three of the beach mornings have both children in them: one morning,
      // two books, kept once. That is the whole architecture in three rows.
      const bothOfThem = /beach/i.test(String(m.raw_text ?? ""));
      // And a few carry nobody's name, which is not a gap — they are the
      // household's year, and they are what the tagging screen is for.
      const nobody = i % 9 === 4;
      if (nobody) return [];
      return bothOfThem
        ? [
            { memory_id: m.id, subject_id: subjectId },
            { memory_id: m.id, subject_id: "demo-theo" },
          ]
        : [{ memory_id: m.id, subject_id: subjectId }];
    }),
    subject_inboxes: [
      { subject_id: subjectId, token: "k3mfwqbtsxnhjdrv2p8c6zgy", accept_from_anyone: false,
        rotated_at: null, created_at: day(0) },
    ],
    memory_clusters: clusters, cluster_memories: clusterMembers,
    // The weekly note's record. Empty, so the demo shows a first week
    // rather than a fourth — which is the state most worth getting right.
    noticed: [],
    // The graph's memory, empty on purpose: the demo shows the question
    // being asked rather than an archive where somebody already answered it.
    entities: [],
    entity_aliases: [],
    entity_memories: [],
    entity_resolutions: [],
    billing_events: [
      { family_id: familyId, kind: "invoice.paid", plan: "monthly", state: "active",
        amount_aud: 1900, note: null, created_at: day(300) },
      { family_id: familyId, kind: "invoice.paid", plan: "monthly", state: "active",
        amount_aud: 1900, note: null, created_at: day(330) },
      { family_id: familyId, kind: "subscription.active", plan: "monthly", state: "active",
        amount_aud: null, note: null, created_at: day(120) },
    ],
    follow_up_questions: [
      { id: "q-0", subject_id: subjectId, cluster_id: "cluster-0", status: "pending", answer: null, created_at: day(0),
        question: "I noticed the same blue rabbit appears in quite a few photos. Does it have a name?",
        reason: "Bun Bun appears in a third of the year's photographs but nothing explains him." },
      { id: "q-1", subject_id: subjectId, cluster_id: "cluster-1", status: "pending", answer: null, created_at: day(0),
        question: "There are photos of her swimming in March and again in November. Did anything change about swimming for her this year?",
        reason: "Photographs record that it happened twice; they cannot record that it got easier." },
      { id: "q-2", subject_id: subjectId, cluster_id: "cluster-3", status: "answered", created_at: day(0),
        question: "Grandpa appears in a lot of Thursday photos. Was that a regular routine?",
        answer: "Every Thursday. They water the pots in order, then he gives her a biscuit.",
        reason: "A weekly pattern the photographs show but cannot explain." },
    ],
    little_things: [
      ["current_obsession", "garbage trucks — knows the whole Tuesday route"],
      ["comfort_object", "Bun Bun, a blue rabbit, goes everywhere"],
      ["favourite_food", "strawberries, checked personally before eating"],
      ["funny_word", "“my byself”"],
      ["bedtime_ritual", "exactly three songs, counted on fingers"],
      ["favourite_person", "Grandpa, on Thursdays"],
    ].map(([category, value], i) => ({
      id: `lt-${i}`, subject_id: subjectId, category, value,
      recorded_date: day(120), source_memory_id: null, created_at: day(120),
    })),
    books: [{
      id: bookId, subject_id: subjectId, year_number: florencesYear.yearNumber,
      title: florencesYear.title,
      subtitle: "Florence", start_date: florencesYear.start, end_date: florencesYear.end,
      status: "review",
      cover_theme: null, cover_colour: null, page_count: pages.length, digital_pdf_path: null,
      print_pdf_path: null, cover_pdf_path: null, approved_at: null,
      listen_token: null, created_at: day(0),
    }],
    book_sections: sections, book_pages: pages, book_content_blocks: blocks,
    book_approvals: [], print_orders: [], jobs: [],

    // A charge announced and not yet taken, so the dashboard banner and the
    // cancel page can both be looked at.
    renewals: [{
      id: "demo-renewal", subject_id: subjectId, book_id: bookId, year_number: 3,
      status: "scheduled", scheduled_for: day(380), announced_at: day(366),
      reminded_at: null, cancelled_at: null, cancelled_by: null, charged_at: null,
      skipped_reason: null, failure_reason: null,
      amount_aud: 19900, payment_intent_id: null, created_at: day(366),
    }],

    // The shared archive: the parent who keeps it, and Florence's grandfather,
    // whose additions wait for her.
    family_memberships: [
      { id: "mem-owner", family_id: familyId, user_id: DEMO_USER.id, role: "owner",
        display_name: "Mum", invited_by: null, created_at: day(0) },
      { id: "mem-gran", family_id: familyId, user_id: "demo-grandpa", role: "contributor",
        display_name: "Grandpa", invited_by: DEMO_USER.id, created_at: day(30) },
    ],
    family_invitations: [
      { id: "inv-1", family_id: familyId, email: "nonna@example.com", role: "contributor",
        token: "demo-token", invited_by: DEMO_USER.id,
        expires_at: day(400), accepted_at: null, accepted_by: null, created_at: day(300) },
    ],
    // Anchored by content rather than index, so the conversation stays
    // attached to the thing it is actually about when the seed changes.
    memory_comments: [
      {
        id: "c-1",
        memory_id: memories.find((m) => /garbage truck/i.test(String(m.raw_text)))?.id,
        author_user_id: "demo-grandpa",
        body: "She has been waving at that truck since before she could walk.",
        created_at: day(281),
      },
      {
        id: "c-2",
        memory_id: memories.find((m) => /swimming/i.test(String(m.raw_text)))?.id,
        author_user_id: "demo-grandpa",
        body: "We watched from the car park. She did not stop talking about it.",
        created_at: day(300),
      },
    ],
  };
}

// ------------------------------------------------------- query builder

/** Parent rows pulled in by a nested select, keyed by the child table. */
const PARENTS: Record<string, { table: string; fk: string; as: string }[]> = {
  book_pages: [{ table: "book_sections", fk: "section_id", as: "book_sections" }],
  family_memberships: [{ table: "profiles", fk: "user_id", as: "profiles" }],
  // Duplicate detection reads an asset with its memory's family, to answer
  // "does this archive already hold this photograph".
  media_assets: [{ table: "memories", fk: "memory_id", as: "memories" }],
  renewals: [{ table: "subjects", fk: "subject_id", as: "subjects" }],
};

interface Nested {
  table: string;
  fk: string;
  as: string;
  /** A join table's own parent, for `memory_people(family_members(name))`. */
  through?: { table: string; fk: string; as: string };
}

const NESTED: Record<string, Nested[]> = {
  book_pages: [{ table: "book_content_blocks", fk: "page_id", as: "book_content_blocks" }],
  memory_clusters: [{ table: "cluster_memories", fk: "cluster_id", as: "cluster_memories" }],
  // The graph reads an entity together with every name the family has used
  // for it, so the fake client has to know that relation exists too.
  entities: [{ table: "entity_aliases", fk: "entity_id", as: "entity_aliases" }],
  memories: [
    { table: "memory_tags", fk: "memory_id", as: "memory_tags" },
    {
      table: "memory_people",
      fk: "memory_id",
      as: "memory_people",
      through: { table: "family_members", fk: "family_member_id", as: "family_members" },
    },
    {
      table: "memory_subjects",
      fk: "memory_id",
      as: "memory_subjects",
      through: { table: "subjects", fk: "subject_id", as: "subjects" },
    },
  ],
};

/**
 * The relations a select asks for, ignoring anything nested inside them.
 *
 * Used to fail loudly on a relation this client does not implement. The file
 * promises that a page growing a new query cannot silently render empty, and
 * for the operators that was true — .not() and .gte() threw. Relations were
 * the hole: memory_people(...) simply came back undefined, so the entire
 * person half of the memory graph was missing from the demo and nothing
 * anywhere said so.
 */
function relationsIn(select: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let word = "";

  for (const ch of select) {
    if (ch === "(") {
      if (depth === 0 && word.trim()) out.push(word.trim().replace(/^.*[,\s]/, ""));
      depth++;
      word = "";
    } else if (ch === ")") {
      depth--;
      word = "";
    } else if (depth === 0) {
      word += ch;
    }
  }

  return out;
}

class Query implements PromiseLike<{ data: any; error: any; count?: number }> {
  private rows: Row[];
  private wantSingle = false;
  private maybe = false;
  private head = false;
  private wantCount = false;

  constructor(private db: Record<string, Row[]>, private table: string, private select = "*") {
    this.rows = [...(db[table] ?? [])];

    // Attach the nested relations the pages ask for. Only the shapes actually
    // used are supported — anything else fails loudly below, not quietly.
    const attached = new Set<string>();

    for (const rel of NESTED[table] ?? []) {
      if (!select.includes(rel.as)) continue;
      attached.add(rel.as);
      this.rows = this.rows.map((r) => ({
        ...r,
        [rel.as]: (db[rel.table] ?? [])
          .filter((c) => c[rel.fk] === r.id)
          .map((c) =>
            rel.through
              ? {
                  ...c,
                  [rel.through.as]:
                    (db[rel.through.table] ?? []).find((p) => p.id === c[rel.through!.fk]) ?? null,
                }
              : c
          ),
      }));
    }
    if (table === "book_pages" && select.includes("books(")) {
      attached.add("books");
      this.rows = this.rows.map((r) => ({ ...r, books: db.books.find((b) => b.id === r.book_id) }));
    }
    // Parent lookups, as opposed to the child collections above. The book
    // overview labels each page with the chapter it belongs to, so without
    // this the demo shows the fallback and hides whether the real path works.
    for (const parent of PARENTS[table] ?? []) {
      // `memories(...)` and `memories!inner(...)` name the same relation. The
      // modifier changes what PostgREST does with a row that has no parent,
      // not which parent it is — and matching only the bare form meant the
      // duplicate check in registerUploadedPhoto threw here, so no file could
      // be uploaded in demo mode at all.
      const inner = `${parent.as}!inner`;
      const wanted = select.includes(`${parent.as}(`)
        ? parent.as
        : select.includes(`${inner}(`)
          ? inner
          : null;
      if (!wanted) continue;
      attached.add(wanted);
      this.rows = this.rows.map((r) => ({
        ...r,
        [parent.as]: (db[parent.table] ?? []).find((p) => p.id === r[parent.fk]) ?? null,
      }));
      // !inner means a row without a parent is not returned.
      if (wanted === inner) this.rows = this.rows.filter((r) => r[parent.as]);
    }
    if (table === "print_orders" && select.includes("books(")) {
      attached.add("books");
      this.rows = this.rows.map((r) => ({ ...r, books: db.books.find((b) => b.id === r.book_id) }));
    }

    for (const wanted of relationsIn(select)) {
      if (attached.has(wanted)) continue;
      throw new Error(
        `demo client does not implement ${table}.${wanted}(...) — add it to NESTED or PARENTS`
      );
    }
  }

  eq(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] === val); return this; }
  neq(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] !== val); return this; }
  /** Only the null/not-null forms are used, which is all this supports. */
  is(col: string, val: null) { this.rows = this.rows.filter((r) => (r[col] ?? null) === val); return this; }
  /**
   * PostgREST's negation, as `.not(col, "is", null)`.
   *
   * Added because its absence was a 500 that appeared only in demo mode —
   * the app typechecked, the production client had the method, and the fake
   * one silently did not. A demo client missing an operator does not fail
   * loudly at build time; it fails on the page.
   */
  not(col: string, op: string, val: any) {
    if (op !== "is") throw new Error(`demo client does not implement .not(_, "${op}", _)`);
    this.rows = this.rows.filter((r) => (r[col] ?? null) !== val);
    return this;
  }
  in(col: string, vals: any[]) { this.rows = this.rows.filter((r) => vals.includes(r[col])); return this; }
  /**
   * Range filters.
   *
   * Added after .gte() produced a 500 that existed only in demo mode — the
   * second operator to do that, after .not(). String comparison is correct
   * for the ISO dates and timestamps these are used on, and wrong for
   * nothing this fixture holds.
   */
  gte(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] >= val); return this; }
  lte(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] <= val); return this; }
  gt(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] > val); return this; }
  lt(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] < val); return this; }
  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? -1 : 1;
    this.rows.sort((a, b) => (a[col] > b[col] ? dir : a[col] < b[col] ? -dir : 0));
    return this;
  }
  limit(n: number) { this.rows = this.rows.slice(0, n); return this; }
  single() { this.wantSingle = true; return this; }
  maybeSingle() { this.maybe = true; return this; }

  then<R1 = any, R2 = never>(
    resolve?: ((v: { data: any; error: any; count?: number }) => R1 | PromiseLike<R1>) | null,
    reject?: ((r: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    let data: any = this.rows;
    if (this.wantSingle) data = this.rows[0] ?? null;
    else if (this.maybe) data = this.rows[0] ?? null;
    if (this.head) data = null;
    const out = { data, error: null as any, count: this.rows.length };
    return Promise.resolve(out).then(resolve, reject);
  }

  /** select() is also callable mid-chain for count/head queries. */
  selectAgain(_cols: string, opts?: { count?: string; head?: boolean }) {
    if (opts?.head) this.head = true;
    if (opts?.count) this.wantCount = true;
    return this;
  }
}

/**
 * Writes, applied to the in-memory tables for the life of the process.
 *
 * They were accepted and discarded, which was fine while every demo screen
 * was read-only and stopped being fine the moment one had buttons on it.
 * "Ignore" that visibly does nothing is a worse demonstration of the product
 * than no button at all — and, in the same way the collapsed-array bug did,
 * it makes a working feature look broken in the only place anybody looks at
 * it first.
 *
 * Nothing here survives a restart, which is the right amount of persistence:
 * enough to try the product, not enough to have to reset it.
 */
class Mutation implements PromiseLike<{ data: any; error: any }> {
  private filters: [string, any][] = [];
  private wanted = false;
  private one = false;

  constructor(
    private store: Record<string, Row[]>,
    private table: string,
    private mode: "insert" | "update" | "delete",
    private payload?: any
  ) {}

  /** Callers ask for the written rows back; without this they get null. */
  select() { this.wanted = true; return this; }
  single() { this.one = true; return this; }
  maybeSingle() { this.one = true; return this; }
  eq(column: string, value: any) { this.filters.push([column, value]); return this; }
  in() { return this; }

  private matches(row: Row): boolean {
    return this.filters.every(([c, v]) => (row as any)[c] === v);
  }

  private apply(): any {
    const rows = (this.store[this.table] ??= []);

    if (this.mode === "insert") {
      // Shape follows the input, as real Supabase does: insert one row and
      // .select() gives one row, insert an array and it gives an array. An
      // earlier version collapsed an array to its first element, so any
      // caller inserting several and mapping the result crashed — in demo
      // mode only, which is the worst place for it to be true.
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).filter(Boolean);
      const written = list.map((r: any) => ({
        id: `demo-${Math.abs(hashish(JSON.stringify(r)))}`,
        ...r,
      }));
      rows.push(...written);
      return Array.isArray(this.payload) ? written : (written[0] ?? null);
    }

    if (this.mode === "update") {
      const hit = rows.filter((r) => this.matches(r));
      for (const r of hit) Object.assign(r, this.payload);
      return hit;
    }

    const kept = rows.filter((r) => !this.matches(r));
    const gone = rows.filter((r) => this.matches(r));
    this.store[this.table] = kept;
    return gone;
  }

  then<R1 = any, R2 = never>(
    resolve?: ((v: { data: any; error: any }) => R1 | PromiseLike<R1>) | null,
    reject?: ((r: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    const written = this.apply();
    const data = this.one && Array.isArray(written) ? (written[0] ?? null) : written;
    return Promise.resolve({ data: this.wanted ? data : null, error: null }).then(resolve, reject);
  }
}

/** Stable pseudo-id for demo rows; no randomness, so a re-run matches. */
function hashish(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/**
 * One set of tables for the process.
 *
 * Built per client until writes started landing, at which point every
 * userClient() and adminClient() call was handing out its own private copy of
 * the archive — so a server action wrote to a store that the page render then
 * never read from, and every button in the demo silently did nothing.
 */
// On globalThis rather than in a module variable because a module variable is
// not one variable: Next builds separate module graphs for rendering and for
// server actions, so a page and the action its button calls each got their
// own tables. The write landed; the read looked somewhere else; the button
// did nothing and said nothing. Same reason the Prisma client lives here.
const STORE = Symbol.for("qotidia.demo.tables");
type Global = typeof globalThis & { [STORE]?: Record<string, Row[]> };

export function demoClient(): any {
  const g = globalThis as Global;
  const db = (g[STORE] ??= buildTables());
  return {
    from(table: string) {
      return {
        select(cols = "*", opts?: { count?: string; head?: boolean }) {
          const q = new Query(db, table, cols);
          return (q as any).selectAgain(cols, opts);
        },
        insert(row?: any) { return new Mutation(db, table, "insert", row); },
        update(patch?: any) { return new Mutation(db, table, "update", patch ?? {}); },
        upsert(row?: any) { return new Mutation(db, table, "insert", row); },
        delete() { return new Mutation(db, table, "delete"); },
      };
    },
    rpc(fn: string) {
      if (fn === "book_listenable") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    },
    // No storage stub. Files go through lib/storage/provider.ts, which hands
    // demo mode the in-memory store — and that is where the generated
    // photographs now come from.
    auth: {
      getUser() { return Promise.resolve({ data: { user: DEMO_USER }, error: null }); },
    },
  };
}

export const isDemoMode = () => process.env.DEMO_MODE === "1";
