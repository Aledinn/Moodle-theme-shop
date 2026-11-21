import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";

// Curated local responses: this checks the website, not a running Go/database service.
const server = await createServer({ server: { port: 0, strictPort: false }, logLevel: "silent" });
let browser;
try {
  await server.listen();
  const origin = `http://localhost:${server.httpServer.address().port}`;
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const hostile = "<img src=x onerror=alert(1)>";
  const theme = {
    id: "9007199254740993", name: "Curated sample " + "LongMetadata".repeat(12),
    description: hostile + "description".repeat(35), author: "author".repeat(35),
    site: "hostname".repeat(35) + ".example.com", version: "version".repeat(30), rules: [],
  };
  await page.route("**/api/themes**", (route) => route.fulfill({
    json: route.request().url().includes("/api/themes/") ? theme : { items: [theme], nextCursor: null },
  }));
  await page.goto(origin);
  const link = page.getByRole("link", { name: theme.name, exact: true });
  await link.waitFor();
  for (const width of [320, 375, 600, 780, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const layout of ["Grid", "List"]) {
      await page.getByRole("button", { name: `${layout} view` }).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${layout} fits ${width}px`);
      assert.ok(await page.locator(".theme-card").evaluate((card) => {
        const footer = card.querySelector(".theme-card__footer").getBoundingClientRect();
        return [...card.querySelectorAll("h3, .theme-card__description, .theme-card__meta")].every((field) => {
          const bounds = field.getBoundingClientRect();
          return bounds.right <= footer.left || bounds.left >= footer.right ||
            bounds.bottom <= footer.top || bounds.top >= footer.bottom;
        });
      }), `${layout} metadata and footer do not overlap at ${width}px`);
      assert.equal(await page.locator('img[src="x"], script:not([type="module"])').count(), 0);
    }
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByRole("button", { name: "Grid view" }).click();
  await mkdir(".cache", { recursive: true });
  await page.screenshot({ path: ".cache/issue-4-mobile.png", fullPage: true });
  // Reach and activate the detail link using keyboard navigation alone.
  await page.goto(origin);
  await link.waitFor();
  let reached = false;
  for (let step = 0; step < 40; step++) {
    await page.keyboard.press("Tab");
    if (await link.evaluate((element) => element === document.activeElement)) { reached = true; break; }
  }
  assert.ok(reached, "theme details link is reachable by keyboard");
  await page.keyboard.press("Enter");
  await page.waitForURL(`${origin}/themes/${theme.id}`);
  await page.getByRole("heading", { name: theme.name }).waitFor();
  await page.reload();
  await page.getByText(theme.description, { exact: true }).waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: ".cache/issue-4-details.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("Catalog Chromium checks passed: curated metadata, mobile grid/list, keyboard details navigation and refresh.");
} finally {
  await browser?.close();
  await server.close();
}
