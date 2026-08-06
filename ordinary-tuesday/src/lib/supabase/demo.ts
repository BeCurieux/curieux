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

export const DEMO_USER = {
  id: "demo-user",
  email: "demo@qotidia.test",
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
  [119, "photo", "Thursday at Grandpa's again. Same routine: pots, then biscuits.", ["grandpa"]],
  [126, "photo", "New swimming pool. She asked to go 'under under'.", ["swimming"]],
  [133, "quote", "I do it my byself.", ["phrase"]],
  [147, "photo", "Yellow boots, no rain in sight. Non-negotiable.", ["yellow_boots"]],
  [161, "photo", "Grandma's birthday lunch.", ["grandma"]],
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
  const start = new Date();
  start.setFullYear(start.getFullYear() - 1);
  const day = (n: number) => {
    const d = new Date(start);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // Florence is two, turning three — so the dashboard and her book agree.
  const dob = new Date(start);
  dob.setFullYear(dob.getFullYear() - 2);
  const dobIso = dob.toISOString().slice(0, 10);

  const familyId = "demo-family";
  const subjectId = "demo-subject";

  const members = [
    ["Sarah", "Mum"], ["James", "Dad"], ["Margaret", "Grandma"], ["Tom", "Grandpa"],
  ].map(([name, relationship], i) => ({
    id: `member-${i}`, family_id: familyId, name, relationship,
    nickname_used_by_child: relationship, created_at: day(0),
  }));

  const memories: Row[] = [];
  const tags: Row[] = [];
  const assets: Row[] = [];
  MEMORY_SEED.forEach(([offset, type, text, tagList], i) => {
    const id = `mem-${i}`;
    // The last two are Grandpa's, and are waiting — so the review queue has
    // something in it and the dashboard shows the prompt.
    const fromGrandpa = i >= MEMORY_SEED.length - 2;
    memories.push({
      id, subject_id: subjectId,
      created_by: fromGrandpa ? "demo-grandpa" : DEMO_USER.id,
      type,
      raw_text: text, transcript: null, location: null, metadata: {},
      memory_date: day(offset), created_at: day(offset),
      contribution_status: fromGrandpa ? "pending" : "approved",
      reviewed_by: null, reviewed_at: null,
    });
    tagList.forEach((tag, t) =>
      tags.push({ id: `tag-${i}-${t}`, memory_id: id, tag, source: "parent" }));
    if (type === "photo") {
      assets.push({
        id: `asset-${i}`, memory_id: id, storage_path: `demo/${i}.svg`,
        mime_type: "image/svg+xml", width: 1600, height: 2100,
        checksum: `demo-${i}`, processing_status: "complete",
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
    families: [{ id: familyId, owner_user_id: DEMO_USER.id, family_name: "Demo family", created_at: day(0) }],
    family_members: members,
    subjects: [{
      id: subjectId, family_id: familyId, subject_type: "child",
      display_name: "Florence", date_of_birth: dobIso, pronouns: "she/her",
      photo_path: null, created_at: day(0),
    }],
    memories, memory_tags: tags, media_assets: assets, memory_people: [],
    memory_clusters: clusters, cluster_memories: clusterMembers,
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
      id: bookId, subject_id: subjectId, year_number: 2, title: "The Year You Were Two",
      subtitle: "Florence", start_date: day(0), end_date: day(365), status: "review",
      cover_theme: null, page_count: pages.length, digital_pdf_path: null,
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
  renewals: [{ table: "subjects", fk: "subject_id", as: "subjects" }],
};

const NESTED: Record<string, { table: string; fk: string; as: string }[]> = {
  book_pages: [{ table: "book_content_blocks", fk: "page_id", as: "book_content_blocks" }],
  memory_clusters: [{ table: "cluster_memories", fk: "cluster_id", as: "cluster_memories" }],
  memories: [{ table: "memory_tags", fk: "memory_id", as: "memory_tags" }],
};

class Query implements PromiseLike<{ data: any; error: any; count?: number }> {
  private rows: Row[];
  private wantSingle = false;
  private maybe = false;
  private head = false;
  private wantCount = false;

  constructor(private db: Record<string, Row[]>, private table: string, private select = "*") {
    this.rows = [...(db[table] ?? [])];
    // Attach the nested relations the pages ask for. Only the shapes actually
    // used are supported — anything else should fail loudly, not quietly.
    for (const rel of NESTED[table] ?? []) {
      if (!select.includes(rel.as)) continue;
      this.rows = this.rows.map((r) => ({
        ...r,
        [rel.as]: (db[rel.table] ?? []).filter((c) => c[rel.fk] === r.id),
      }));
    }
    if (table === "book_pages" && select.includes("books(")) {
      this.rows = this.rows.map((r) => ({ ...r, books: db.books.find((b) => b.id === r.book_id) }));
    }
    // Parent lookups, as opposed to the child collections above. The book
    // overview labels each page with the chapter it belongs to, so without
    // this the demo shows the fallback and hides whether the real path works.
    for (const parent of PARENTS[table] ?? []) {
      if (!select.includes(`${parent.as}(`)) continue;
      this.rows = this.rows.map((r) => ({
        ...r,
        [parent.as]: (db[parent.table] ?? []).find((p) => p.id === r[parent.fk]) ?? null,
      }));
    }
    if (table === "print_orders" && select.includes("books(")) {
      this.rows = this.rows.map((r) => ({ ...r, books: db.books.find((b) => b.id === r.book_id) }));
    }
  }

  eq(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] === val); return this; }
  neq(col: string, val: any) { this.rows = this.rows.filter((r) => r[col] !== val); return this; }
  /** Only the null/not-null forms are used, which is all this supports. */
  is(col: string, val: null) { this.rows = this.rows.filter((r) => (r[col] ?? null) === val); return this; }
  in(col: string, vals: any[]) { this.rows = this.rows.filter((r) => vals.includes(r[col])); return this; }
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

/** Writes are accepted and discarded: demo mode never persists. */
class Mutation implements PromiseLike<{ data: any; error: any }> {
  private returning: any = null;
  constructor(row?: any) {
    // Echo back what was written, with an id, so a caller doing
    // .insert(...).select("id").single() gets a row rather than null.
    // Returning null here made every such call look like a silent failure
    // in demo mode — and hid a real 500 in the route that did it.
    if (row) {
      const first = Array.isArray(row) ? row[0] : row;
      this.returning = { id: `demo-${Math.abs(hashish(JSON.stringify(first)))}`, ...first };
    }
  }
  select() { return this; }
  single() { return this; }
  maybeSingle() { return this; }
  eq() { return this; }
  in() { return this; }
  then<R1 = any, R2 = never>(
    resolve?: ((v: { data: any; error: any }) => R1 | PromiseLike<R1>) | null,
    reject?: ((r: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return Promise.resolve({ data: this.returning, error: null }).then(resolve, reject);
  }
}

/** Stable pseudo-id for demo rows; no randomness, so a re-run matches. */
function hashish(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export function demoClient(): any {
  const db = buildTables();
  return {
    from(table: string) {
      return {
        select(cols = "*", opts?: { count?: string; head?: boolean }) {
          const q = new Query(db, table, cols);
          return (q as any).selectAgain(cols, opts);
        },
        insert(row?: any) { return new Mutation(row); },
        update() { return new Mutation(); },
        upsert() { return new Mutation(); },
        delete() { return new Mutation(); },
      };
    },
    rpc(fn: string) {
      if (fn === "book_listenable") return Promise.resolve({ data: [], error: null });
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from() {
        return {
          // Photographs are generated, so a "signed URL" is just the image.
          createSignedUrl(path: string) {
            const n = Number(path.match(/(\d+)/)?.[1] ?? 0);
            return Promise.resolve({ data: { signedUrl: demoPhoto(n) }, error: null });
          },
          upload() { return Promise.resolve({ data: { path: "demo" }, error: null }); },
        };
      },
    },
    auth: {
      getUser() { return Promise.resolve({ data: { user: DEMO_USER }, error: null }); },
    },
  };
}

export const isDemoMode = () => process.env.DEMO_MODE === "1";
