/*
 * Five demo shops with drawn goods and loud palettes, for press and social.
 *
 * The fixture catalogue exists to be *bad* — deliberately mediocre so the
 * template has something to flatter. That makes it the wrong thing to show
 * anybody. These are the opposite: recognisable objects and saturated brand
 * colour, so the page can be judged on how it merchandises.
 *
 * Illustrated, not photographed. Nothing here pretends to be a real product
 * shot, because a real product shot would belong to a real merchant.
 *
 * Writes into .cache/shop, which is gitignored — the shops are derived, and
 * regenerating them is one command.
 */
import { resolve } from "node:path";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";

const uri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
const CX = 600;
const CY = 760;
let uid = 0;

const ground = (a, b, tone) => `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="lit" cx="0.32" cy="0.2" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="cast" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${tone}" stop-opacity="0.3"/><stop offset="1" stop-color="${tone}" stop-opacity="0"/></radialGradient>
    <radialGradient id="contact" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${tone}" stop-opacity="0.5"/><stop offset="0.6" stop-color="${tone}" stop-opacity="0.18"/><stop offset="1" stop-color="${tone}" stop-opacity="0"/></radialGradient>
    <radialGradient id="vignette" cx="0.5" cy="0.42" r="0.72"><stop offset="0.55" stop-color="${tone}" stop-opacity="0"/><stop offset="1" stop-color="${tone}" stop-opacity="0.16"/></radialGradient>
    <linearGradient id="surface" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tone}" stop-opacity="0"/><stop offset="0.24" stop-color="${tone}" stop-opacity="0.13"/><stop offset="1" stop-color="${tone}" stop-opacity="0.05"/></linearGradient>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="26"/></filter>
    <filter id="sheen" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="72"/></filter>
  </defs>
  <rect width="1200" height="1500" fill="url(#g)"/>
  <rect width="1200" height="1500" fill="url(#lit)"/>
  <!-- A horizon. Without it every object floats on a wall; with it they sit on
       something, which is most of what separates a product shot from an icon.
       It fades in rather than starting at full strength — a hard edge across
       the backdrop reads as a band of colour, not as a table. -->
  <rect y="760" width="1200" height="740" fill="url(#surface)"/>
  <rect width="1200" height="1500" fill="url(#vignette)"/>`;

/**
 * What the object is standing on.
 *
 * Two shadows, not one. A single wide blur reads as a sticker dropped onto the
 * background; the tight dark one under the base is what makes it look in
 * contact with the surface, and the wide one is only the ambient falloff.
 */
const floor = (w, y) => `
  <ellipse cx="${CX}" cy="${y + 6}" rx="${w * 0.66}" ry="${w * 0.115}" fill="url(#cast)"/>
  <ellipse cx="${CX}" cy="${y}" rx="${w * 0.3}" ry="${w * 0.045}" fill="url(#contact)"/>`;

/**
 * One object, lit.
 *
 * The first version filled the silhouette flat and laid a lighter rectangle
 * over its left third — a hard vertical seam down every product, which is what
 * made these read as icons rather than as things. This lights it instead: a
 * three-stop gradient across the form, a blurred specular down the lit side, an
 * occlusion at the foot where it meets its own shadow, and a rim along the top
 * edge. All four are clipped to the silhouette, so the shape library above did
 * not have to change at all.
 */
const shape = (d, ink, extra = "") => {
  const id = ++uid;
  return `
    <linearGradient id="f${id}" x1="0.08" y1="0" x2="0.92" y2="1">
      <stop offset="0" stop-color="${ink.light}"/>
      <stop offset="0.42" stop-color="${ink.body}"/>
      <stop offset="1" stop-color="${ink.dark}"/>
    </linearGradient>
    <clipPath id="c${id}"><path d="${d}"/></clipPath>
    <path d="${d}" fill="url(#f${id})"/>
    <g clip-path="url(#c${id})">
      <ellipse cx="${CX - 170}" cy="${CY - 150}" rx="170" ry="380" fill="#fff" opacity="0.22" filter="url(#sheen)"/>
      <ellipse cx="${CX + 60}" cy="1200" rx="520" ry="150" fill="${ink.dark}" opacity="0.34" filter="url(#soft)"/>
      <path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.26" stroke-width="7" transform="translate(0 5)"/>
    </g>${extra}`;
};

// --- vessels: bottles, jars, tubes, stemware, tumblers, carafes -------------

const bottle = (ink, { w = 300, h = 520, neckW = 130, neckH = 110, capH = 80, r = 42, label = true }) => {
  const half = w / 2, nHalf = neckW / 2, top = CY - h / 2 + neckH / 2;
  const d = `M${CX - nHalf} ${top - neckH} h${neckW} v${neckH * 0.62} q0 ${neckH * 0.4} ${half - nHalf} ${neckH * 0.4}
    v${h - neckH} q0 ${r} ${-r} ${r} h${-(w - 2 * r)} q${-r} 0 ${-r} ${-r} v${-(h - neckH)} q${half - nHalf} 0 ${half - nHalf} ${-neckH * 0.4} z`;
  const cap = `<rect x="${CX - nHalf - 16}" y="${top - neckH - capH}" width="${neckW + 32}" height="${capH + 12}" rx="16" fill="${ink.dark}"/>`;
  const tag = label ? `<rect x="${CX - half * 0.74}" y="${top + h * 0.34}" width="${half * 1.48}" height="${h * 0.3}" rx="10" fill="${ink.dark}" opacity="0.9"/>` : "";
  return { art: shape(d, ink, cap + tag), base: top + h };
};

const jar = (ink, { w = 420, h = 320, capH = 74, r = 34 }) => {
  const half = w / 2, top = CY - h / 2 + 30;
  const d = `M${CX - half} ${top} h${w} v${h - r} q0 ${r} ${-r} ${r} h${-(w - 2 * r)} q${-r} 0 ${-r} ${-r} z`;
  return { art: shape(d, ink, `<rect x="${CX - half - 14}" y="${top - capH}" width="${w + 28}" height="${capH + 10}" rx="18" fill="${ink.dark}"/>`), base: top + h };
};

const tube = (ink, { w = 210, h = 520, capH = 64 }) => {
  const half = w / 2, top = CY - h / 2, bottom = top + h;
  const d = `M${CX - half} ${top} h${w} v${h - 26} q0 26 ${-26} 26 h${-(w - 52)} q${-26} 0 ${-26} ${-26} z`;
  const extra = `<rect x="${CX - half}" y="${top}" width="${w}" height="26" rx="8" fill="${ink.dark}"/>
    <rect x="${CX - half * 0.62}" y="${bottom - 8}" width="${half * 1.24}" height="${capH}" rx="14" fill="${ink.dark}"/>`;
  return { art: shape(d, ink, extra), base: bottom + capH };
};

const stemmed = (ink, { bowlW = 330, bowlH = 190, stemH = 210, footW = 220, coupe = true }) => {
  const half = bowlW / 2, top = CY - (bowlH + stemH) / 2, bowlBottom = top + bowlH;
  const d = coupe
    ? `M${CX - half} ${top} h${bowlW} q0 ${bowlH} ${-half} ${bowlH} q${-half} 0 ${-half} ${-bowlH} z`
    : `M${CX - half} ${top} q0 ${bowlH * 1.25} ${half} ${bowlH * 1.25} q${half} 0 ${half} ${-bowlH * 1.25} z`;
  const drop = coupe ? 0 : bowlH * 0.25;
  const base = bowlBottom + stemH + drop;
  const extra = `<rect x="${CX - 15}" y="${bowlBottom + drop}" width="30" height="${stemH}" fill="${ink.body}"/>
    <ellipse cx="${CX}" cy="${base}" rx="${footW / 2}" ry="${footW * 0.11}" fill="${ink.dark}"/>`;
  return { art: shape(d, ink, extra), base };
};

const tumbler = (ink, { w = 280, h = 380, taper = 26 }) => {
  const half = w / 2, top = CY - h / 2;
  const d = `M${CX - half} ${top} h${w} l${-taper} ${h} h${-(w - 2 * taper)} z`;
  const facets = `<g opacity="0.3" fill="${ink.dark}"><rect x="${CX - half + 26}" y="${top + h * 0.3}" width="18" height="${h * 0.55}"/><rect x="${CX - 9}" y="${top + h * 0.3}" width="18" height="${h * 0.55}"/><rect x="${CX + half - 44}" y="${top + h * 0.3}" width="18" height="${h * 0.55}"/></g>`;
  return { art: shape(d, ink, facets), base: top + h };
};

const carafe = (ink, { w = 400, h = 380, neckW = 120, neckH = 200, capH = 0 }) => {
  const half = w / 2, nHalf = neckW / 2, top = CY - (h + neckH) / 2;
  const d = `M${CX - nHalf} ${top} h${neckW} v${neckH * 0.5} q0 ${neckH * 0.5} ${half - nHalf} ${neckH * 0.6}
    q${-(half - nHalf) * 0.1} ${h * 0.2} 0 ${h * 0.62} q0 ${h * 0.18} ${-half} ${h * 0.18} q${-half} 0 ${-half} ${-h * 0.18}
    q0 ${-h * 0.42} 0 ${-h * 0.62} q${half - nHalf} ${-neckH * 0.1} ${half - nHalf} ${-neckH * 0.6} z`;
  const stopper = capH ? `<path d="M${CX - nHalf - 24} ${top} h${neckW + 48} l${-30} ${-capH} h${-(neckW - 12)} z" fill="${ink.dark}"/>` : "";
  return { art: shape(d, ink, stopper), base: top + neckH + h };
};

// --- garments ---------------------------------------------------------------

const tee = (ink, { w = 440, h = 470, sleeve = 150, long = false }) => {
  const half = w / 2, top = CY - h / 2, sw = long ? sleeve + 90 : sleeve;
  const d = `M${CX - half} ${top + 60} l${-sw} ${40} l${-6} ${long ? 220 : 130} l${sw * 0.62} ${20} l${6} ${-100}
    v${h - 130} h${w} v${-(h - 130)} l${6} ${100} l${sw * 0.62} ${-20} l${-6} ${long ? -220 : -130} l${-sw} ${-40} z`;
  const extra = `<ellipse cx="${CX}" cy="${top + 62}" rx="${w * 0.2}" ry="34" fill="${ink.dark}"/>
    <g opacity="0.4" fill="${ink.dark}"><rect x="${CX - half}" y="${top + 190}" width="${w}" height="34"/><rect x="${CX - half}" y="${top + 280}" width="${w}" height="34"/></g>`;
  return { art: shape(d, ink, extra), base: top + h };
};

const dungarees = (ink, { w = 400, h = 560 }) => {
  const half = w / 2, top = CY - h / 2, legTop = top + h * 0.45;
  const d = `M${CX - half} ${top + 90} v${h * 0.36} h${w} v${-(h * 0.36)} h${-70} v${-70} h${-(w - 140)} v70 z
    M${CX - half} ${legTop} h${half - 16} v${h * 0.55} h${-(half - 60)} z M${CX + 16} ${legTop} h${half - 16} l${-44} ${h * 0.55} h${-(half - 60)} z`;
  const extra = `<g fill="${ink.dark}"><rect x="${CX - half + 44}" y="${top}" width="46" height="110" rx="16"/><rect x="${CX + half - 90}" y="${top}" width="46" height="110" rx="16"/><rect x="${CX - 46}" y="${top + 150}" width="92" height="80" rx="12" opacity="0.5"/></g>`;
  return { art: shape(d, ink, extra), base: top + h };
};

const sock = (ink, { w = 190, h = 420 }) => {
  const top = CY - h / 2;
  const d = `M${CX - w / 2 - 40} ${top} h${w} v${h * 0.62} q0 ${h * 0.2} ${w * 0.5} ${h * 0.22} h${w * 0.62}
    q${w * 0.34} 0 ${w * 0.34} ${-w * 0.42} q0 ${-w * 0.4} ${-w * 0.44} ${-w * 0.44} q${-w * 0.3} ${-0.02} ${-w * 0.44} ${-h * 0.06} v${-h * 0.62} z`;
  return { art: shape(d, ink, `<rect x="${CX - w / 2 - 40}" y="${top}" width="${w}" height="70" rx="10" fill="${ink.dark}"/>`), base: top + h };
};

const hat = (ink, { w = 460, h = 300 }) => {
  const half = w / 2, top = CY - h / 2;
  const d = `M${CX - half * 0.62} ${top} q${half * 0.62} ${-40} ${w * 0.62} 0 l${half * 0.2} ${h * 0.62}
    q${half * 0.4} ${20} ${half * 0.36} ${h * 0.2} q${-half} ${60} ${-w} 0 q${-4} ${-h * 0.16} ${half * 0.36} ${-h * 0.2} z`;
  const band = `<path d="M${CX - half * 0.78} ${top + h * 0.5} q${half * 0.78} ${44} ${w * 0.78} 0 l6 46 q${-half * 0.8} ${44} ${-w * 0.8} 0 z" fill="${ink.dark}" opacity="0.75"/>`;
  return { art: shape(d, ink, band), base: top + h };
};

const boot = (ink, { w = 200, h = 380 }) => {
  const top = CY - h / 2;
  const one = (x) => `M${x} ${top} h${w * 0.8} v${h * 0.66} l${w * 0.5} ${8} q${w * 0.22} ${6} ${w * 0.22} ${w * 0.26} v${h * 0.1} h${-(w * 1.52)} z`;
  return { art: shape(`${one(CX - w)} ${one(CX + w * 0.12)}`, ink), base: top + h };
};

const bag = (ink, { w = 380, h = 460 }) => {
  const half = w / 2, top = CY - h / 2;
  const d = `M${CX - half} ${top + 60} q0 ${-60} ${half} ${-60} q${half} 0 ${half} 60 v${h - 60} q0 ${44} ${-44} ${44} h${-(w - 88)} q${-44} 0 ${-44} ${-44} z`;
  const extra = `<path d="M${CX - 90} ${top + 66} q0 ${-120} ${90} ${-120} q${90} 0 ${90} 120 h-52 q0 ${-70} ${-38} ${-70} q${-38} 0 ${-38} 70 z" fill="${ink.dark}"/>
    <rect x="${CX - half * 0.66}" y="${top + h * 0.5}" width="${half * 1.32}" height="${h * 0.32}" rx="18" fill="${ink.dark}" opacity="0.55"/>`;
  return { art: shape(d, ink, extra), base: top + h };
};

// --- tools and paper --------------------------------------------------------

const hammer = (ink, { h = 540 }) => {
  const top = CY - h / 2;
  const d = `M${CX - 34} ${top + 150} h68 v${h - 150} q0 30 ${-34} 30 q${-34} 0 ${-34} ${-30} z
    M${CX - 150} ${top} h${240} q40 0 40 40 v70 q0 40 ${-40} 40 h${-240} q${-40} ${-30} ${-30} ${-75} q${-10} ${-45} ${30} ${-75} z`;
  return { art: shape(d, ink), base: top + h };
};

const disc = (ink, { r = 210 }) => ({
  art: shape(`M${CX} ${CY - r} a${r} ${r} 0 1 1 -0.1 0 z`, ink,
    `<circle cx="${CX}" cy="${CY}" r="${r * 0.52}" fill="${ink.dark}" opacity="0.85"/><rect x="${CX - r * 0.14}" y="${CY + r * 0.6}" width="${r * 0.28}" height="${r * 0.5}" rx="10" fill="${ink.dark}"/>`),
  base: CY + r,
});

const hexNut = (ink, { r = 190 }) => {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    return `${(CX + r * Math.cos(a)).toFixed(1)} ${(CY + r * Math.sin(a)).toFixed(1)}`;
  });
  return { art: shape(`M${pts.join("L")}z`, ink, `<rect x="${CX - r * 0.3}" y="${CY + r * 0.7}" width="${r * 0.6}" height="${r * 0.9}" fill="${ink.dark}" opacity="0.8"/><circle cx="${CX}" cy="${CY}" r="${r * 0.42}" fill="${ink.dark}"/>`), base: CY + r * 1.6 };
};

const bar = (ink, { w = 760, h = 130, window: win = true }) => {
  const d = `M${CX - w / 2} ${CY - h / 2} h${w} q22 0 22 22 v${h - 44} q0 22 ${-22} 22 h${-w} q${-22} 0 ${-22} ${-22} v${-(h - 44)} q0 ${-22} 22 ${-22} z`;
  const vial = win ? `<rect x="${CX - 90}" y="${CY - 34}" width="180" height="68" rx="34" fill="${ink.dark}"/><circle cx="${CX + 16}" cy="${CY}" r="22" fill="${ink.light}"/>` : "";
  return { art: shape(d, ink, vial), base: CY + h / 2 };
};

const blade = (ink, { h = 520 }) => {
  const top = CY - h / 2;
  const d = `M${CX - 46} ${top} h92 v${h * 0.46} h${-16} v${h * 0.46} l${-30} ${h * 0.08} l${-30} ${-h * 0.08} v${-h * 0.46} h${-16} z`;
  return { art: shape(d, ink, `<rect x="${CX - 54}" y="${top + h * 0.42}" width="108" height="40" rx="12" fill="${ink.dark}"/>`), base: top + h };
};

const pencil = (ink, { w = 92, h = 620, angle = -9 }) => {
  const top = CY - h / 2;
  const d = `M${CX - w / 2} ${top + 90} l${w / 2} ${-90} l${w / 2} 90 v${h - 90} h${-w} z`;
  const extra = `<path d="M${CX - w / 2} ${top + 90} l${w / 2} ${-90} l${w / 2} 90 z" fill="${ink.dark}"/><rect x="${CX - w / 2}" y="${top + h * 0.76}" width="${w}" height="46" fill="${ink.dark}" opacity="0.6"/>`;
  return { art: `<g transform="rotate(${angle} ${CX} ${CY})">${shape(d, ink, extra)}</g>`, base: top + h };
};

const apron = (ink, { w = 430, h = 600 }) => {
  const half = w / 2, top = CY - h / 2;
  const d = `M${CX - half * 0.56} ${top} h${w * 0.56} v${h * 0.2} l${half * 0.44} ${h * 0.12} v${h * 0.62} q0 ${34} ${-34} ${34} h${-(w - 68)} q${-34} 0 ${-34} ${-34} v${-(h * 0.62)} l${half * 0.44} ${-h * 0.12} z`;
  const extra = `<rect x="${CX - half - 40}" y="${top + h * 0.34}" width="${w + 80}" height="26" rx="13" fill="${ink.dark}"/><rect x="${CX - half * 0.62}" y="${top + h * 0.52}" width="${half * 1.24}" height="${h * 0.24}" rx="12" fill="${ink.dark}" opacity="0.6"/>`;
  return { art: shape(d, ink, extra), base: top + h };
};

const stone = (ink, { w = 560, h = 200 }) => ({
  art: shape(`M${CX - w / 2} ${CY - h / 2} h${w} q18 0 18 18 v${h - 36} q0 18 ${-18} 18 h${-w} q${-18} 0 ${-18} ${-18} v${-(h - 36)} q0 ${-18} 18 ${-18} z`, ink,
    `<rect x="${CX - w / 2}" y="${CY - 4}" width="${w}" height="8" fill="${ink.dark}" opacity="0.5"/>`),
  base: CY + h / 2,
});

const book = (ink, { w = 440, h = 580, rules = 4 }) => {
  const half = w / 2, top = CY - h / 2;
  const under = `<rect x="${CX - half + 22}" y="${top + 22}" width="${w}" height="${h}" rx="16" fill="${ink.dark}" opacity="0.4"/>`;
  const d = `M${CX - half} ${top} h${w} q16 0 16 16 v${h - 32} q0 16 ${-16} 16 h${-w} q${-16} 0 ${-16} ${-16} v${-(h - 32)} q0 ${-16} 16 ${-16} z`;
  const lines = Array.from({ length: rules }, (_, i) => `<rect x="${CX - half * 0.5}" y="${top + h * 0.3 + i * 54}" width="${half * 1.1}" height="10" rx="5" fill="${ink.dark}" opacity="0.35"/>`).join("");
  return { art: under + shape(d, ink, `<rect x="${CX - half}" y="${top}" width="52" height="${h}" rx="14" fill="${ink.dark}"/>${lines}`), base: top + h };
};

const envelope = (ink, { w = 540, h = 380 }) => {
  const half = w / 2, top = CY - h / 2;
  const d = `M${CX - half} ${top} h${w} q16 0 16 16 v${h - 32} q0 16 ${-16} 16 h${-w} q${-16} 0 ${-16} ${-16} v${-(h - 32)} q0 ${-16} 16 ${-16} z`;
  return { art: shape(d, ink, `<path d="M${CX - half} ${top + 8} l${half} ${h * 0.56} l${half} ${-h * 0.56}" fill="none" stroke="${ink.dark}" stroke-width="16" stroke-linejoin="round" opacity="0.75"/>`), base: top + h };
};

const cards = (ink, { w = 440, h = 300 }) => {
  const half = w / 2, top = CY - h / 2;
  const stack = [24, 12, 0].map((o, i) => `<rect x="${CX - half + o}" y="${top - o}" width="${w}" height="${h}" rx="14" fill="${i === 2 ? ink.body : ink.dark}" opacity="${i === 2 ? 1 : 0.45}"/>`).join("");
  return { art: stack + `<g fill="${ink.dark}" opacity="0.5"><rect x="${CX - half + 30}" y="${top + 40}" width="${w * 0.5}" height="12" rx="6"/><rect x="${CX - half + 30}" y="${top + 90}" width="${w * 0.32}" height="12" rx="6"/></g>`, base: top + h };
};

const inkpot = (ink, { w = 300, h = 280 }) => {
  const half = w / 2, top = CY - h / 2;
  const d = `M${CX - half} ${top + 50} q0 ${-50} ${half} ${-50} q${half} 0 ${half} 50 v${h - 50} q0 26 ${-26} 26 h${-(w - 52)} q${-26} 0 ${-26} ${-26} z`;
  return { art: shape(d, ink, `<rect x="${CX - 92}" y="${top - 76}" width="184" height="86" rx="18" fill="${ink.dark}"/>`), base: top + h };
};

/** One scale for every object, applied last, so relative sizes stay intact. */
const FILL = 1.34;
const draw = (palette, { art, base }) => uri(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  ${ground(palette.g1, palette.g2, palette.tone)}
  <g transform="translate(${CX} ${CY}) scale(${FILL}) translate(${-CX} ${-CY})">${floor(560, base + 26)}${art}</g>
</svg>`);

/**
 * The same object with the ground and the cast shadow taken away, on a canvas
 * cropped to the drawing.
 *
 * Posters want the goods loose — floating over a colour, overlapping a phone,
 * running off an edge. A cutout is that, and it is the same path data as the
 * catalogue image so the two can never show different objects.
 */
const cutout = ({ art }) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="180 300 840 920">${art}</svg>`;

// ------------------------------------------------------------------- brands

const BRANDS = [
  {
    key: "bench-and-bolt", mood: "utility", name: "Bench & Bolt", tagline: "Tools that outlast the job.",
    prompt: "the starter kit for someone setting up their first workshop",
    colorway: { background: "#FAF6EF", surface: "#F0E7D6", text: "#141210", accent: "#FF4A0D" },
    palette: { g1: "#EFE6D6", g2: "#D9CCB6", tone: "#4A3A22" }, ink: { body: "#FF4A0D", dark: "#8A2400", light: "#FFC7A8" },
    collections: ["Hand tools", "Workshop", "Sharpening", "Repairs"],
    products: [
      ["framing-hammer", "Framing Hammer", 62, "Hand tools", (i) => hammer(i, {})],
      ["steel-tape-8m", "Steel Tape 8m", 28, "Hand tools", (i) => disc(i, {})],
      ["hex-bolt-set", "Hex Bolt Set", 14, "Workshop", (i) => hexNut(i, {})],
      ["spirit-level", "Spirit Level 600mm", 46, "Workshop", (i) => bar(i, {})],
      ["bench-chisel", "Bench Chisel No.4", 34, "Sharpening", (i) => blade(i, {})],
      ["oiled-apron", "Oiled Canvas Apron", 78, "Workshop", (i) => apron(i, {})],
      ["carpenter-pencils", "Carpenter Pencils", 9, "Workshop", (i) => pencil(i, {})],
      ["whetstone", "Combination Whetstone", 52, "Sharpening", (i) => stone(i, {})],
    ],
    soldOut: ["bench-chisel"], sale: { handle: "carpenter-pencils", was: 14 },
  },
  {
    key: "sea-salt-skin", mood: "clean", name: "Sea Salt Skin", tagline: "Three steps. Nothing else.",
    prompt: "a first routine for someone who has never used skincare",
    colorway: { background: "#EDF8F5", surface: "#D4EFE8", text: "#06211C", accent: "#00B08B" },
    palette: { g1: "#DCF0EB", g2: "#B9DED5", tone: "#08423A" }, ink: { body: "#00B08B", dark: "#00584A", light: "#A9EEDD" },
    collections: ["Cleanse", "Treat", "Protect", "Refills"],
    products: [
      ["kelp-cleanser", "Kelp Cleanser 200ml", 26, "Cleanse", (i) => bottle(i, {})],
      ["salt-scrub", "Sea Salt Scrub", 22, "Cleanse", (i) => jar(i, {})],
      ["day-balm", "Day Balm SPF30", 32, "Protect", (i) => tube(i, {})],
      ["night-oil", "Night Oil", 44, "Treat", (i) => bottle(i, { w: 250, h: 420, neckW: 90, neckH: 150, capH: 60, label: false })],
      ["hand-cream", "Hand Cream", 16, "Protect", (i) => tube(i, { w: 180, h: 430 })],
      ["clay-mask", "Rock Clay Mask", 28, "Treat", (i) => jar(i, { w: 380, h: 270, capH: 66 })],
      ["lip-salve", "Lip Salve", 9, "Protect", (i) => jar(i, { w: 200, h: 130, capH: 50, r: 24 })],
      ["refill-pouch", "Cleanser Refill", 18, "Refills", (i) => bag(i, { w: 340, h: 440 })],
    ],
    soldOut: ["night-oil"], sale: { handle: "clay-mask", was: 36 },
  },
  {
    key: "pip-and-pockets", mood: "playful", name: "Pip & Pockets", tagline: "Made for sticky hands.",
    prompt: "a gift edit for a two-year-old who ruins everything",
    colorway: { background: "#FFF2F7", surface: "#FFD9E7", text: "#2A0E1A", accent: "#FF1F6B" },
    palette: { g1: "#FFE1EC", g2: "#FFC0D6", tone: "#7A0A38" }, ink: { body: "#FF1F6B", dark: "#A80B44", light: "#FFC2D8" },
    collections: ["Everyday", "Outdoors", "Knitwear", "Hand-me-downs"],
    products: [
      ["cord-dungarees", "Cord Dungarees", 42, "Everyday", (i) => dungarees(i, {})],
      ["stripe-tee", "Stripe Tee", 18, "Everyday", (i) => tee(i, {})],
      ["rainbow-socks", "Rainbow Socks", 8, "Everyday", (i) => sock(i, {})],
      ["bucket-hat", "Bucket Hat", 16, "Outdoors", (i) => hat(i, {})],
      ["puddle-boots", "Puddle Boots", 34, "Outdoors", (i) => boot(i, {})],
      ["knit-cardigan", "Knit Cardigan", 38, "Knitwear", (i) => tee(i, { w: 460, h: 520, long: true })],
      ["small-backpack", "Small Backpack", 28, "Outdoors", (i) => bag(i, {})],
      ["patch-set", "Iron-On Patch Set", 7, "Hand-me-downs", (i) => cards(i, {})],
    ],
    soldOut: ["puddle-boots"], sale: { handle: "stripe-tee", was: 26 },
  },
  {
    key: "folio-press", mood: "editorial", name: "Folio Press", tagline: "Paper worth keeping.",
    prompt: "a desk set for someone who has started writing by hand again",
    colorway: { background: "#F5F3ED", surface: "#E7E3D7", text: "#0F0F13", accent: "#1B23E8" },
    palette: { g1: "#E9E6DC", g2: "#CFCABA", tone: "#1B1B2E" }, ink: { body: "#1B23E8", dark: "#0A0F7A", light: "#B9BDFF" },
    collections: ["Notebooks", "Ink", "Desk", "Archive"],
    products: [
      ["casebound-notebook", "Casebound Notebook", 24, "Notebooks", (i) => book(i, {})],
      ["blue-black-ink", "Blue-Black Ink 50ml", 19, "Ink", (i) => inkpot(i, {})],
      ["pocket-diary", "Pocket Diary", 16, "Notebooks", (i) => book(i, { w: 330, h: 470, rules: 3 })],
      ["letter-set", "Letter Set", 14, "Archive", (i) => envelope(i, {})],
      ["steel-ruler", "Steel Ruler 30cm", 11, "Desk", (i) => bar(i, { w: 800, h: 90, window: false })],
      ["pencil-b", "Pencil B, box of 12", 12, "Desk", (i) => pencil(i, {})],
      ["blotter", "Desk Blotter", 38, "Desk", (i) => stone(i, { w: 640, h: 380 })],
      ["index-cards", "Index Cards", 8, "Archive", (i) => cards(i, {})],
    ],
    soldOut: ["blotter"], sale: { handle: "letter-set", was: 21 },
  },
  {
    key: "maison-verre", mood: "luxe", name: "Maison Verre", tagline: "Cut by hand, in Lyon.",
    prompt: "a wedding list for two people who already own everything",
    colorway: { background: "#0C0B0E", surface: "#191620", text: "#F6F0E4", accent: "#E8B23C" },
    palette: { g1: "#221C29", g2: "#0D0B10", tone: "#000000" }, ink: { body: "#E8B23C", dark: "#8A6318", light: "#FFE6AC" },
    collections: ["Stemware", "Barware", "Table", "Restoration"],
    products: [
      ["coupe-glass", "Coupe", 64, "Stemware", (i) => stemmed(i, {})],
      ["cut-tumbler", "Cut Tumbler", 48, "Barware", (i) => tumbler(i, {})],
      ["carafe", "Carafe", 96, "Table", (i) => carafe(i, {})],
      ["decanter", "Crystal Decanter", 240, "Barware", (i) => carafe(i, { w: 440, h: 400, neckW: 120, neckH: 170, capH: 110 })],
      ["highball", "Highball", 44, "Barware", (i) => tumbler(i, { w: 230, h: 470, taper: 14 })],
      ["wine-glass", "Wine Glass", 58, "Stemware", (i) => stemmed(i, { bowlW: 270, bowlH: 210, stemH: 220, footW: 200, coupe: false })],
      ["ice-bucket", "Ice Bucket", 180, "Table", (i) => tumbler(i, { w: 460, h: 380, taper: 40 })],
      ["candle-holder", "Candle Holder", 72, "Table", (i) => stemmed(i, { bowlW: 190, bowlH: 130, stemH: 190, footW: 230 })],
    ],
    soldOut: ["decanter"], sale: { handle: "highball", was: 60 },
  },
];

const iso = "2026-08-14T09:00:00.000Z";

/**
 * A real photograph, if somebody has put one there.
 *
 * The drawings below are a stopgap and have always looked like one. They exist
 * because the environment this repository is developed in has no outbound
 * network at all — it cannot reach a storefront, a CDN or a stock library — so
 * the pipeline needed *something* to render, and a drawn shape was the only
 * thing available. What a visitor sees as a result is a real page full of
 * crude blobs: the layout is genuine output, the goods in it plainly are not.
 *
 * So: drop photographs into `public/demo/<brand-key>/<handle>.<ext>` and they
 * win. Nothing else changes — `pnpm press` regenerates the catalogues, the
 * shops and the screenshots, and the front page picks them up because it is
 * screenshotting the real renderer rather than displaying artwork.
 *
 * Local files rather than remote URLs on purpose, and it is not only about
 * this environment. A demo that hotlinks somebody's CDN breaks the day that
 * store is deleted, and it breaks silently, on the page whose entire job is
 * convincing a merchant their shop will look good.
 *
 * `public/demo/README.md` has the naming and the shot list.
 */
const PHOTO_DIR = resolve(import.meta.dirname, "../../public/demo");
const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

function photoFor(brandKey, handle) {
  for (const extension of PHOTO_EXTENSIONS) {
    const file = resolve(PHOTO_DIR, brandKey, `${handle}${extension}`);
    if (existsSync(file)) return `/demo/${brandKey}/${handle}${extension}`;
  }
  return null;
}

/**
 * Has this brand been photographed at all?
 *
 * It decides what a *missing* photograph means. Before any real photography
 * exists, every product gets a drawing and the set is at least consistent.
 * Once some products have photographs, a drawing beside them reads as a bug
 * rather than a fallback — and it is also a lie about the catalogue, because
 * the honest state of a product with no photograph is *no image*, not a
 * picture somebody drew for it.
 *
 * The renderer already has a considered answer for that: the product's initial,
 * set large in the display face, which is a deliberate treatment rather than a
 * broken one. Leaving these imageless is what puts that on the demo instead of
 * only in a test — which is what `public/demo/README.md` asks for when it says
 * to leave one product without a file.
 */
function brandHasPhotos(brandKey, products) {
  return products.some(([handle]) => photoFor(brandKey, handle) !== null);
}

mkdirSync(resolve(import.meta.dirname, "../../.cache/press"), { recursive: true });

for (const brand of BRANDS) {
  const photographed = brandHasPhotos(brand.key, brand.products);

  const products = brand.products.map(([handle, title, price, type, art], index) => {
    const photo = photoFor(brand.key, handle);
    const available = !brand.soldOut.includes(handle);
    const was = brand.sale.handle === handle ? brand.sale.was : undefined;
    return {
      handle, id: String(9000 + index), title,
      description: `${title} from ${brand.name}.`,
      vendor: brand.name, productType: type, tags: [type.toLowerCase()],
      url: `https://example.invalid/${brand.key}/products/${handle}`,
      images: photo
        ? [{ url: photo, width: 1200, height: 1500 }]
        : photographed
          ? // Genuinely missing, not drawn over. See `brandHasPhotos`.
            []
          : [{ url: draw(brand.palette, art(brand.ink)), width: 1200, height: 1500 }],
      // Not part of the catalogue — see below.
      variants: [{ id: String(49000 + index), title: "Default Title", price, ...(was ? { compareAtPrice: was } : {}), available, options: [] }],
      price: { min: price, max: price },
      ...(was ? { compareAtPrice: { min: was, max: was } } : {}),
      available,
      availabilityKnown: true,
    };
  });

  // Cutouts for the posters, written beside the shop rather than inside it:
  // the catalogue is what a merchant's store would give us, and a
  // transparent PNG of a product is not something a store gives anybody.
  brand.products.forEach(([handle, , , , art], index) => {
    writeFileSync(
      resolve(import.meta.dirname, `../../.cache/press/cutout-${brand.mood}-${index}.svg`),
      cutout(art(brand.ink)),
    );
  });

  writeFileSync(resolve(import.meta.dirname, `../../.cache/shop/demo-${brand.mood}.json`), JSON.stringify({
    config: {
      version: 1,
      brand: { name: brand.name, tagline: brand.tagline, storeUrl: `https://example.invalid/${brand.key}/` },
      theme: { colorway: brand.colorway, typography: "editorial-serif", mood: brand.mood, density: "regular", cornerRadius: "soft" },
      blocks: [
        { id: "hero", block: { type: "hero", headline: brand.tagline, media: { kind: "productImage", handle: products[0].handle, imageIndex: 0 } } },
        { id: "edit", block: { type: "productGrid", title: "The edit", products: products.map((p) => ({ handle: p.handle })), layout: "grid" } },
        { id: "links", block: { type: "linkList", links: brand.collections.map((label) => ({ label, url: `https://example.invalid/${brand.key}/collections/${label.toLowerCase().replace(/\s+/g, "-")}` })) } },
      ],
      meta: { prompt: brand.prompt, generatedAt: iso, audience: brand.prompt },
    },
    catalogue: { currency: "GBP", products, productCount: products.length, truncated: false },
    ingestedAt: iso,
  }));
  console.log(`demo-${brand.mood}`.padEnd(15), brand.name.padEnd(15), brand.colorway.accent);
}
