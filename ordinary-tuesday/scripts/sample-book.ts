// Render a sample volume through the real rendering path.
//
// Uses the production HTML renderer, the real archetypes, the real colour
// system and the real preflight — only the photographs are stand-ins. The
// output is a genuine press-spec file: exact A4 trim, no bleed, cover as
// page one, mirrored margins, folios on the outer edge.
//
// Usage: npm run sample

import { chromium } from "playwright-core";
import { writeFileSync, mkdirSync } from "node:fs";
import { renderBookHtml, type RenderPage } from "../src/lib/pdf/html";
import { colourForAge } from "../src/lib/book/colours";
import { FORMAT } from "../src/lib/book/format";
import { runPreflight } from "../src/lib/pdf/preflight";

const outDir = process.argv[2] ?? "./sample";
mkdirSync(outDir, { recursive: true });

// Stand-in photographs: flat tone with a label, so layout and pacing read
// clearly without pretending to be real images.
function photo(seed: number, w = 2400, h = 3200): string {
  const tones = [
    ["#C6C6BE", "#9DA09A"], ["#CFC7B6", "#A39B8C"], ["#BFC4C2", "#8E9491"],
    ["#D2C9B4", "#A69C86"], ["#C2C6C8", "#93999B"],
  ];
  const [a, b] = tones[seed % tones.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
    </linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
      font-family="Helvetica" font-size="${Math.round(w / 30)}"
      fill="rgba(25,26,23,0.26)" letter-spacing="8">PHOTOGRAPH</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

type B = RenderPage["blocks"][number];
const T = (type: B["type"], content: string): B => ({ type, content });

// A volume built to the brief's architecture (§10), paced to §11.
const PAGES: Omit<RenderPage, "pageNumber">[] = [
  { archetype: "chapter_opener", hideFolio: true, blocks: [
    T("label", "One"), T("heading", "This was you at two"),
    T("text", "You lived in the grey house with the broken gate. You were two in April. By June you had opinions about boots.")] },
  { archetype: "hero_photograph", hideFolio: true, blocks: [T("photo", photo(1))] },
  { archetype: "portrait_plus_story", blocks: [
    T("photo", photo(2, 2400, 1800)), T("caption", "The front window, most mornings"),
    T("text", "You could hear the truck three streets away. You would stop whatever you were doing and stand at the window, completely still, until it had gone past.")] },
  { archetype: "quote_page", blocks: [
    T("quote", "I do it my byself."), T("annotation", "Florence, 2 years 4 months")] },
  { archetype: "chapter_opener", hideFolio: true, blocks: [
    T("label", "Two"), T("heading", "The year of Bun Bun"),
    T("text", "A blue rabbit, one ear longer than the other, in roughly a third of every photograph taken this year.")] },
  { archetype: "object_portrait", blocks: [
    T("photo", photo(3, 900, 1200)), T("caption", "Bun Bun, after the wash"),
    T("text", "He went through the machine in August. It was an emotional afternoon. He came back slightly paler and has been favoured ever since.")] },
  { archetype: "three_photo_sequence", blocks: [
    T("photo", photo(4, 1600, 1600)), T("photo", photo(5, 1600, 1600)), T("photo", photo(6, 1600, 1600)),
    T("caption", "Beach week — the bucket was for shells; the shells were for Bun Bun")] },
  { archetype: "quote_page", blocks: [
    T("quote", "Moon gone to work."), T("annotation", "Florence, 2 years 7 months")] },
  { archetype: "people_page", blocks: [
    T("label", "Your people"), T("heading", "Grandpa"),
    T("photo", photo(7, 2000, 1500)), T("caption", "Thursday, most weeks"),
    T("text", "Thursdays were his. You watered every pot on the back step, in order, and then you had a biscuit. He taught you to whistle in September. It is more of a hiss, but you are committed.")] },
  { archetype: "two_photo_sequence", blocks: [
    T("photo", photo(8, 1800, 2400)), T("photo", photo(9, 1800, 2400)),
    T("caption", "March, and again in November")] },
  { archetype: "chapter_opener", hideFolio: true, blocks: [
    T("label", "Three"), T("heading", "The yellow boots")] },
  { archetype: "hero_photograph", hideFolio: true, blocks: [T("photo", photo(10))] },
  { archetype: "portrait_plus_story", blocks: [
    T("photo", photo(11, 2400, 1800)), T("caption", "Not raining. Not once."),
    T("text", "For four months, only the yellow boots would do. Sandpit, supermarket, dinner at Grandma's — and once, unsuccessfully, bed.")] },
  { archetype: "little_things", blocks: [
    T("heading", "The little things"),
    T("text", "Currently eating: Strawberries. Constantly."),
    T("text", "Currently saying: “I do it.”"),
    T("text", "Currently carrying: Bun Bun."),
    T("text", "Currently avoiding: Any shoe that is not yellow."),
    T("text", "Bedtime requirement: Exactly three songs."),
    T("text", "Currently believes: The moon has gone to work."),
    T("text", "Favourite person: Grandpa, on Thursdays."),
    T("text", "Current project: Whistling.")] },
  { archetype: "ordinary_days", blocks: [
    T("heading", "Ordinary Tuesdays"),
    T("photo", photo(12, 1400, 1400)), T("photo", photo(13, 1400, 1400)),
    T("photo", photo(14, 1400, 1400)), T("photo", photo(15, 1400, 1400)),
    T("caption", "Breakfast · the walk · the kitchen bench · bath")] },
  { archetype: "then_now", blocks: [
    T("photo", photo(16, 1800, 2400)), T("photo", photo(17, 1800, 2400)),
    T("annotation", "January"), T("annotation", "December")] },
  { archetype: "quote_page", blocks: [
    T("quote", "Three songs. Then one more three songs."), T("annotation", "Florence, 2 years 11 months")] },
  { archetype: "closing_page", blocks: [
    T("photo", photo(18, 2000, 1500)), T("heading", "At the end of two"),
    T("text", "You are two and eleven months. You can nearly whistle. You still will not wear the blue boots, and nobody has tried to make you in some time."),
    T("annotation", "This volume was closed in April.")] },
];

const pages: RenderPage[] = PAGES.map((p, i) => ({ ...p, pageNumber: i + 1 }));

const book = {
  cover: {
    childName: "Florence", ageWord: "TWO", year: "2028",
    imprint: "Ordinary Tuesday", colour: colourForAge(2), spineWidthMm: 12.8,
  },
  pages,
};

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox", "--font-render-hinting=none"],
});
const page = await browser.newPage();
await page.setContent(renderBookHtml(book, "print"), { waitUntil: "networkidle" });

const audit = await page.evaluate((safeMm: number) => {
  const overflow: number[] = [], unsafe: number[] = [], blank: number[] = [];
  const safePx = safeMm * (96 / 25.4);
  document.querySelectorAll<HTMLElement>(".page[data-page]").forEach((el) => {
    const n = Number(el.dataset.page);
    const box = el.getBoundingClientRect();
    const content = el.querySelector<HTMLElement>(".content");
    if (content && (content.scrollHeight > content.clientHeight + 1 ||
        content.scrollWidth > content.clientWidth + 1)) overflow.push(n);
    const bleedEl = el.querySelector(".full-bleed");
    if (!bleedEl && content) {
      content.querySelectorAll<HTMLElement>("*").forEach((c) => {
        if (!c.textContent?.trim() && c.tagName !== "IMG") return;
        const b = c.getBoundingClientRect();
        if (!b.width || !b.height) return;
        if (b.left - box.left < safePx - 0.5 || b.top - box.top < safePx - 0.5 ||
            box.right - b.right < safePx - 0.5 || box.bottom - b.bottom < safePx - 0.5) {
          if (!unsafe.includes(n)) unsafe.push(n);
        }
      });
    }
    const ink = !!bleedEl || !!el.querySelector(".content img") ||
      (content?.textContent ?? "").trim().length > 0;
    if (!ink) blank.push(n);
  });
  return { overflow, unsafe, blank };
}, FORMAT.safeMarginMm);

const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1 });
writeFileSync(`${outDir}/ordinary-tuesday-sample.pdf`, pdf);
await browser.close();

const result = runPreflight({
  interiorPages: pages.length,
  pageWidthMm: FORMAT.trimWidthMm,
  pageHeightMm: FORMAT.trimHeightMm,
  bleedAdded: false,
  cropMarksAdded: false,
  images: [],
  fontsEmbedded: true,
  colourSpace: FORMAT.colourSpace,
  transparencyFlattened: true,
  overflowPages: audit.overflow,
  safeAreaViolations: audit.unsafe,
  spreadPages: [],
  blankPages: audit.blank,
  uncitedBlocks: 0,
  cover: { colour: book.cover.colour, spineWidthMm: 12.8, spineAuthoritative: true },
});

console.log(`Rendered ${pages.length} interior pages + 2 covers -> ${outDir}/ordinary-tuesday-sample.pdf`);
console.log(result.passed ? "Preflight: PASS" : "Preflight: FAIL");
for (const i of result.issues) console.log(`  [${i.severity}] ${i.code}: ${i.message}`);
