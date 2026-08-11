// ESLint 9 flat config.
//
// Next 16 removed `next lint`, so ESLint is invoked directly and this file
// replaces .eslintrc.json. eslint-config-next 16 ships a flat config array,
// so it is spread in as-is — no FlatCompat, which chokes on it.
//
// `--max-warnings=0` lives in the npm script, so a warning fails the build
// rather than joining a pile nobody reads. That only stays honest while
// rules are switched off deliberately. There is exactly one, argued below.

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "public/**", "out/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      // Off deliberately, not because it is inconvenient.
      //
      // Nearly every image in this product is a private family photograph
      // served as a signed URL that stops working within minutes.
      // `next/image` would fetch each one through the Next image optimizer,
      // which writes an optimized copy into an on-disk cache keyed by URL —
      // putting a decrypted copy of somebody's child outside the private
      // bucket and outliving the signature that was supposed to bound its
      // life. The privacy page tells parents those links expire; an
      // optimizer cache would make that untrue. It would also mean
      // allow-listing the storage host in `remotePatterns`.
      //
      // The handful of static marketing images could use it safely, but the
      // same components switch between a signed photograph and a placeholder
      // (`hero.isPhoto ? <img src={hero.src}/> : <img src="/sample/…"/>`),
      // and one mechanism across both branches is worth more than the
      // optimisation. Accessibility rules on images stay on: a missing alt
      // still fails.
      "@next/next/no-img-element": "off",
    },
  },
];

export default config;
