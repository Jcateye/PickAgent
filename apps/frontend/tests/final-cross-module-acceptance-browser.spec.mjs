import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3204";
const thisDir = path.dirname(new URL(import.meta.url).pathname);
const evidenceDir = process.env.EVIDENCE_DIR
  ? path.resolve(process.env.EVIDENCE_DIR)
  : path.resolve(thisDir, "..", "..", "..", "output", "final-cross-module-acceptance", "browser");

const desktopRoutes = [
  { route: "/overview", file: "desktop-overview.png" },
  { route: "/sku-access", file: "desktop-sku-access.png" },
  { route: "/rule-execution", file: "desktop-rule-execution.png" },
  { route: "/review-approvals", file: "desktop-review-approvals.png" },
  { route: "/report-center", file: "desktop-report-center.png" },
  { route: "/data-sources", file: "desktop-data-sources.png" },
  { route: "/rule-library", file: "desktop-rule-library.png" },
  { route: "/agent-chat", file: "desktop-agent-chat.png" },
];

const mobileRoutes = [
  { route: "/overview", file: "mobile-overview.png" },
  { route: "/sku-access", file: "mobile-sku-access.png" },
  { route: "/review-approvals", file: "mobile-review-approvals.png" },
  { route: "/report-center", file: "mobile-report-center.png" },
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
