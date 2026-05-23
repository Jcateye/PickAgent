import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3204";
const thisDir = path.dirname(new URL(import.meta.url).pathname);
const evidenceDir = process.env.EVIDENCE_DIR
  ? path.resolve(process.env.EVIDENCE_DIR)
  : path.resolve(thisDir, "..", "..", "..", "output", "final-cross-module-acceptance", "browser");

const desktopRoutes = [
  { route: "/dashboard", file: "desktop-dashboard.png" },
  { route: "/sku-health", file: "desktop-sku-health.png" },
  { route: "/activities", file: "desktop-activities.png" },
  { route: "/reviews", file: "desktop-reviews.png" },
  { route: "/reports", file: "desktop-reports.png" },
  { route: "/agent-chat", file: "desktop-agent-chat.png" },
];

const mobileRoutes = [
  { route: "/dashboard", file: "mobile-dashboard.png" },
  { route: "/sku-health", file: "mobile-sku-health.png" },
  { route: "/agent-chat", file: "mobile-agent-chat.png" },
];

test.describe.configure({ mode: "serial" });

test("capture desktop acceptance screenshots", async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1024 });

  for (const item of desktopRoutes) {
    await page.goto(`${baseURL}${item.route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(evidenceDir, item.file), fullPage: true });
  }
});

test("capture mobile acceptance screenshots", async ({ page }) => {
  fs.mkdirSync(evidenceDir, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });

  for (const item of mobileRoutes) {
    await page.goto(`${baseURL}${item.route}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(evidenceDir, item.file), fullPage: true });
  }
});
