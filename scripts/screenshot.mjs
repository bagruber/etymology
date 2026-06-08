// Visual verification: boots the dev server, opens key pages in headless
// Chromium and writes PNGs to screenshots/. Run with: npm run screens
// (first time also needs: npx playwright install chromium)

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const OUT = "screenshots";

const PAGES = [
  { name: "home", path: "/" },
  { name: "father", path: "/word/en-father" },
  { name: "baradar", path: "/word/fa-baradar" },
  { name: "pedar", path: "/word/fa-pedar" },
  { name: "three", path: "/word/en-three" },
];

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server at ${url} did not start in time`);
}

const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort"], {
  shell: true,
  stdio: "ignore",
});

try {
  mkdirSync(OUT, { recursive: true });
  await waitForServer(BASE);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });

  for (const { name, path } of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400); // let layout settle
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    console.log(`captured ${OUT}/${name}.png`);
  }

  await browser.close();
} finally {
  server.kill();
}
