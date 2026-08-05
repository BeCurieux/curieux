// Server-side PDF rendering (brief §3, §18).
// Architecture: HTML template → headless Chromium → press-ready PDF.
// Chromium print-to-PDF was chosen over a PDF library because the same
// HTML/CSS drives on-screen preview, giving deterministic parity between
// what the parent approves and what is printed.

import { chromium } from "playwright-core";
import { renderBookHtml, type RenderBook, type RenderTarget } from "./html";
import { renderCoverHtml, type CoverContent, type CoverGeometry } from "./cover";

export interface RenderResult {
  pdf: Buffer;
  pageCount: number;
  /** page numbers whose content overflowed its frame (preflight input) */
  overflowPages: number[];
}

export async function renderBookPdf(book: RenderBook, target: RenderTarget): Promise<RenderResult> {
  const html = renderBookHtml(book, target);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });

    // Overflow detection: any .content frame whose scroll size exceeds its box.
    const overflowPages = await page.evaluate(() => {
      const bad: number[] = [];
      document.querySelectorAll<HTMLElement>(".page").forEach((pageEl) => {
        const content = pageEl.querySelector<HTMLElement>(".content");
        if (!content) return;
        if (
          content.scrollHeight > content.clientHeight + 1 ||
          content.scrollWidth > content.clientWidth + 1
        ) {
          bad.push(Number(pageEl.dataset.page));
        }
      });
      return bad;
    });

    const pdf = await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      // Digital PDFs may compress; print PDFs keep full quality.
      scale: 1,
    });

    return {
      pdf: Buffer.from(pdf),
      pageCount: book.pages.length,
      overflowPages,
    };
  } finally {
    await browser.close();
  }
}

/**
 * The cover prints as one flat sheet — back, spine, front — sized from the
 * page count and the paper's caliper. Separate from the interior PDF because
 * the press runs it on different stock, in a different pass.
 */
export async function renderCoverPdf(
  content: CoverContent,
  geo: CoverGeometry
): Promise<Buffer> {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(renderCoverHtml(content, geo), { waitUntil: "networkidle" });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, scale: 1 });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
