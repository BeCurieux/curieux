"use client";

// A bench for the typeface.
//
// The landing page renders correctly on one machine and wrongly on another,
// and three theories about why have now been wrong. Every one of them was a
// guess made from a screenshot. This page exists so the next answer is not a
// guess: it asks the browser directly what font it has, whether the bytes
// arrived intact, what the glyphs actually measure, and shows the same
// sentence set three ways so the failure can be pointed at.
//
// It is deliberately not pretty and deliberately unlinked. Nothing in the
// product navigates here; it is a instrument you go to on purpose, at
// /diagnostics/type, and it ships because a fault that only appears on
// somebody else's computer is exactly the kind you cannot debug by looking
// harder at your own.
//
// Everything below is read from the live document. Nothing is hard-coded
// about what the answer should be, because the point is to find out.

import { useEffect, useState } from "react";

const SPECIMEN = "keep the everyday";
const RULER = "HAMBURGEFONTSIV hamburgefontsiv 0123456789";

interface Finding {
  label: string;
  value: string;
  /** True when this is the line that looks wrong. */
  suspect?: boolean;
}

/** Every @font-face src url the page has, dug out of the stylesheets. */
function fontUrls(): string[] {
  const out = new Set<string>();
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue; // cross-origin; not ours
    }
    for (const rule of Array.from(rules)) {
      if (rule.constructor.name !== "CSSFontFaceRule" && !(rule instanceof CSSFontFaceRule)) continue;
      const src = (rule as CSSFontFaceRule).style.getPropertyValue("src");
      for (const m of src.matchAll(/url\(["']?([^"')]+)["']?\)/g)) out.add(m[1]);
    }
  }
  return [...out];
}

/** How wide a string is in a given family, at a fixed size. */
function widthIn(family: string, text: string): number {
  const el = document.createElement("span");
  el.textContent = text;
  el.style.cssText =
    `position:absolute;left:-9999px;top:0;white-space:pre;font-size:100px;` +
    `line-height:1;font-family:${family}`;
  document.body.appendChild(el);
  const w = el.getBoundingClientRect().width;
  el.remove();
  return Math.round(w);
}

export default function TypeDiagnostics() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [family, setFamily] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const found: Finding[] = [];

      // The generated family name Next gave the webfont. Everything else on
      // the page refers to it through this variable, so if it is empty the
      // font never got as far as being declared.
      const variable = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-charter")
        .trim();
      setFamily(variable);
      found.push({
        label: "--font-charter",
        value: variable || "(empty — the font was never declared)",
        suspect: !variable,
      });

      // The variable is a whole stack — the webfont, Next's metric-matched
      // fallback, then Georgia. Anything asking about the webfont itself
      // wants only the first name in it.
      const primary = variable.split(",")[0].trim();

      const bodyFamily = getComputedStyle(document.body).fontFamily;
      found.push({ label: "body font-family (computed)", value: bodyFamily });

      // Did the bytes arrive, and are they the bytes we shipped? A woff2
      // file states its own total length in its header, so a file damaged in
      // transit or by a line-ending conversion disagrees with itself.
      const urls = fontUrls();
      found.push({
        label: "@font-face files declared",
        value: urls.length ? String(urls.length) : "none",
        suspect: urls.length === 0,
      });

      for (const url of urls) {
        try {
          const res = await fetch(url);
          const buf = await res.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const signature = String.fromCharCode(...bytes.subarray(0, 4));
          const declared = new DataView(buf).getUint32(8);
          const intact = signature === "wOF2" && declared === bytes.length;
          found.push({
            label: url.split("/").pop() ?? url,
            value:
              `HTTP ${res.status}, ${bytes.length} bytes, signature ${JSON.stringify(signature)}` +
              `, header says ${declared} bytes` +
              (intact ? " — intact" : " — DOES NOT MATCH"),
            suspect: !intact,
          });
        } catch (e) {
          found.push({ label: url, value: `could not be fetched: ${String(e)}`, suspect: true });
        }
      }

      // What the browser thinks it has loaded.
      //
      // "unloaded" here is not a fault: a browser fetches a face the first
      // time something on the page asks for it, so the italic and the bold
      // are legitimately idle on a page with neither. Only `error` means
      // the browser tried and failed.
      await document.fonts.ready;
      const faces = Array.from(document.fonts as unknown as Iterable<FontFace>);
      found.push({
        label: "FontFace objects",
        value:
          faces.length === 0
            ? "none"
            : faces
                .map((f) => `${f.family} ${f.style} ${f.weight} → ${f.status}`)
                .join("  ·  "),
        suspect: faces.length === 0 || faces.some((f) => f.status === "error"),
      });

      if (primary) {
        // One family, not the stack. `check()` takes a CSS font shorthand,
        // and the stack as written is not a valid one — asking with it
        // returns false on a perfectly healthy machine, which is the kind of
        // false alarm that sends somebody after the wrong bug.
        const usable = document.fonts.check(`100px ${primary}`);
        found.push({
          label: `document.fonts.check("100px ${primary}")`,
          value: String(usable),
          suspect: !usable,
        });
      }

      // The measurement that separates "wrong font" from "broken font".
      //
      // A font that failed to load falls back to Georgia and measures like
      // Georgia. A font that loaded but whose advance widths are wrong
      // measures like nothing else — usually far too narrow, because
      // overlapping glyphs is what a near-zero advance looks like.
      const inWebfont = primary ? widthIn(`${primary}, monospace`, RULER) : 0;
      const inGeorgia = widthIn("Georgia, serif", RULER);
      const inMonospace = widthIn("monospace", RULER);
      const ratio = inGeorgia ? inWebfont / inGeorgia : 0;
      found.push({
        label: "ruler width @100px",
        value:
          `Charter ${inWebfont}px · Georgia ${inGeorgia}px · monospace ${inMonospace}px` +
          ` — Charter is ${ratio.toFixed(2)}× Georgia`,
        // Two serif faces set the same string within a quarter of each other.
        // Outside that, something is wrong with the metrics rather than with
        // the choice of face.
        suspect: ratio < 0.75 || ratio > 1.25,
      });

      found.push({ label: "user agent", value: navigator.userAgent });
      found.push({
        label: "device pixel ratio",
        value: String(window.devicePixelRatio),
      });

      if (!cancelled) setFindings(found);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ padding: "2rem 0", maxWidth: "60rem" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Type diagnostics</h1>
      <p style={{ marginBottom: "2rem", maxWidth: "46ch" }}>
        Three specimens of the same sentence, then what the browser says about
        the font it used. Screenshot the whole page.
      </p>

      {/* The specimens. Same words, same size, three different instructions
          about which face to use — so a failure that affects one and not the
          others has nowhere to hide. */}
      <section style={{ marginBottom: "2.5rem" }}>
        {[
          ["as the site sets it (Charter, webfont)", family ? `${family}, Georgia, serif` : "Georgia, serif"],
          ["forced to Georgia (no webfont)", "Georgia, 'Times New Roman', serif"],
          ["forced to the system sans", "'Segoe UI', -apple-system, Arial, sans-serif"],
        ].map(([label, stack]) => (
          <div key={label} style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.75rem", opacity: 0.6, fontFamily: "monospace" }}>{label}</div>
            <div style={{ fontFamily: stack, fontSize: "3rem", lineHeight: 1.15 }}>{SPECIMEN}</div>
            <div style={{ fontFamily: stack, fontSize: "1rem" }}>{RULER}</div>
          </div>
        ))}
      </section>

      <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>What the browser says</h2>
      {findings === null ? (
        <p>Measuring…</p>
      ) : (
        <dl style={{ fontFamily: "monospace", fontSize: "0.8rem", lineHeight: 1.7 }}>
          {findings.map((f) => (
            <div key={f.label} style={{ marginBottom: "0.4rem" }}>
              <dt style={{ opacity: 0.6 }}>{f.label}</dt>
              <dd
                style={{
                  margin: 0,
                  wordBreak: "break-all",
                  color: f.suspect ? "#8A4327" : undefined,
                  fontWeight: f.suspect ? 700 : undefined,
                }}
              >
                {f.suspect ? "⚠ " : ""}
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
