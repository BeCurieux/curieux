/**
 * A stand-in for `next/font/local`.
 *
 * The real thing is a compiler transform: the import is rewritten at build
 * time into a generated stylesheet plus a class name. Imported by a test
 * runner it resolves to an object, and calling it fails — which takes down
 * every test of every page that picks its own typeface, for a reason that has
 * nothing to do with the page.
 *
 * This returns the same shape with the values a test could reasonably assert
 * on. It deliberately does not fake the CSS: a test that cares which font file
 * loaded should be reading `fonts.ts`, and the browser suite is where type
 * actually gets looked at.
 */

interface LocalFontOptions {
  variable?: string;
}

interface LoadedFont {
  className: string;
  variable: string;
  style: { fontFamily: string };
}

export default function localFont(options: LocalFontOptions = {}): LoadedFont {
  const variable = options.variable ?? "--test-font";
  return {
    className: `test-font${variable}`,
    variable: `test-font${variable}`,
    style: { fontFamily: variable },
  };
}
