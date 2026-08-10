import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://127.0.0.1:3213/", { waitUntil: "networkidle" });
await p.waitForTimeout(700);
await p.screenshot({ path: "shot-hero.png" });
await b.close();
