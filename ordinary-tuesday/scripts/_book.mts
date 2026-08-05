import { renderBookHtml } from "../src/lib/pdf/html";
import { colourForAge } from "../src/lib/book/colours";
interface Scene { sky: string; mid: string; ground: string; subject: string; warmth: number; }

const SCENES: Scene[] = [
  // kitchen morning — warm, low contrast
  { sky: "#E8DCC6", mid: "#C9B393", ground: "#8E7659", subject: "#D9C4A5", warmth: 0.9 },
  // garden, overcast — cool green
  { sky: "#CBD4C6", mid: "#93A388", ground: "#5C6B52", subject: "#B4C0A6", warmth: 0.3 },
  // beach — pale, bright, high key
  { sky: "#DCE4E7", mid: "#C4CDD1", ground: "#A9A491", subject: "#E4DED0", warmth: 0.6 },
  // bath / indoor evening — deep, warm shadow
  { sky: "#B9A48C", mid: "#8A7460", ground: "#4E4034", subject: "#CBB89F", warmth: 1.0 },
  // pool — cool blue-green
  { sky: "#BBCBCE", mid: "#7E9BA1", ground: "#3F5B62", subject: "#CFDADA", warmth: 0.2 },
  // living room, curtain light — neutral
  { sky: "#DAD6CC", mid: "#B3ADA1", ground: "#78716A", subject: "#C8C1B4", warmth: 0.5 },
];

function photo(seed: number, w = 2400, h = 3200): string {
  const s = SCENES[seed % SCENES.length];
  const portrait = h >= w;
  // Subject sits off-centre, alternating side, the way real photographs do.
  const cx = seed % 2 === 0 ? 0.42 : 0.58;
  const cy = portrait ? 0.44 : 0.48;
  const r = portrait ? 0.34 : 0.42;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 100 ${Math.round((h / w) * 100)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0" stop-color="${s.sky}"/>
      <stop offset="0.55" stop-color="${s.mid}"/>
      <stop offset="1" stop-color="${s.ground}"/>
    </linearGradient>
    <radialGradient id="subj" cx="${cx}" cy="${cy}" r="${r}">
      <stop offset="0" stop-color="${s.subject}" stop-opacity="0.95"/>
      <stop offset="0.6" stop-color="${s.subject}" stop-opacity="0.45"/>
      <stop offset="1" stop-color="${s.subject}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx="0.5" cy="0.45" r="0.78">
      <stop offset="0.5" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.3"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="0.7"/></filter>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)"/>
  <!-- soft background masses, out of focus -->
  <g filter="url(#soft)" opacity="0.5">
    <ellipse cx="${18 + (seed % 5) * 6}" cy="${20 + (seed % 3) * 8}" rx="26" ry="14" fill="${s.sky}" opacity="0.7"/>
    <ellipse cx="${76 - (seed % 4) * 5}" cy="${58 + (seed % 4) * 6}" rx="30" ry="20" fill="${s.ground}" opacity="0.5"/>
  </g>
  <rect width="100%" height="100%" fill="url(#subj)"/>
  <rect width="100%" height="100%" fill="url(#vig)"/>
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


export const html = renderBookHtml(book as any, "print");