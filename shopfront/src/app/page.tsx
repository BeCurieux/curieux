/**
 * The workbench, not a product surface.
 *
 * Everything generated so far, so that looking at four shops side by side is
 * one click rather than four commands. It is a development tool and it says
 * so — the published shops are the product; this is the bench they sit on.
 */

import Link from "next/link";
import { listShops } from "@/lib/render/store";

export const dynamic = "force-dynamic";

export default async function Index() {
  const shops = await listShops();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px", fontFamily: "var(--font-body, ui-serif, Georgia, serif)" }}>
      <h1 style={{ fontSize: 22, margin: "0 0 6px", letterSpacing: "-0.02em" }}>Shopfront — generated shops</h1>
      <p style={{ margin: "0 0 32px", color: "#666", fontSize: 14, lineHeight: 1.5 }}>
        Run <code>pnpm merchandise &lt;store-url&gt; &quot;&lt;prompt&gt;&quot; --render</code> to add one.
      </p>

      {shops.length === 0 ? (
        <p style={{ color: "#888", fontSize: 14 }}>Nothing generated yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, borderTop: "1px solid #e6e6e6" }}>
          {shops.map((shop) => (
            <li key={shop.key} style={{ borderBottom: "1px solid #e6e6e6" }}>
              <Link
                href={`/preview/${shop.key}`}
                style={{ display: "block", padding: "16px 0", color: "inherit", textDecoration: "none" }}
              >
                <strong style={{ fontSize: 15 }}>{shop.name}</strong>
                <span style={{ color: "#999", fontSize: 13, marginLeft: 8 }}>{shop.blocks} blocks</span>
                <span style={{ display: "block", color: "#666", fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>
                  {shop.prompt}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
