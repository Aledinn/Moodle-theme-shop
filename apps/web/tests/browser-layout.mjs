import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.WEB_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const version = "W".repeat(32); // Maximum valid portable version length.
  await page.route("**/api/themes?*", (route) => route.fulfill({
    json: {
      items: Array.from({ length: 4 }, (_, index) => ({
        id: String(index + 1),
        name: `Theme ${index + 1}`,
        site: "moodle.example.com",
        author: "Author",
        description: "Layout regression fixture",
        version,
      })),
      nextCursor: null,
    },
  }));
  for (const path of ["/", "/?preview=design"]) {
    await page.goto(origin + path);
    await page.getByRole("article").first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const mode of ["grid", "list"]) {
      await page.getByRole("button", {
        name: mode === "grid" ? "Grid view" : "List view",
      }).click();
      for (const width of [1448, 1080, 780, 510, 375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        const layout = await page.evaluate(() => ({
          fitsViewport: document.documentElement.scrollWidth <= innerWidth,
          cards: [...document.querySelectorAll("article")].map((card) => {
            const bounds = card.getBoundingClientRect();
            const button = card.querySelector("button").getBoundingClientRect();
            const label = card.querySelector(".theme-card__downloads").getBoundingClientRect();
            return {
              fitsCard: button.left >= bounds.left && button.right <= bounds.right,
              labelFits: label.left >= bounds.left && label.right <= bounds.right,
              overlaps: button.left < label.right && button.right > label.left &&
                button.top < label.bottom && button.bottom > label.top,
            };
          }),
        }));
        assert.ok(layout.fitsViewport, `${path} ${mode}: viewport overflow at ${width}px`);
        for (const card of layout.cards) {
          assert.ok(card.fitsCard && card.labelFits && !card.overlaps,
            `${path} ${mode}: card footer overflow or overlap at ${width}px`);
        }
      }
    }
    if (path === "/") {
      await page.getByRole("button", { name: "Information about Theme 1", exact: true }).click();
      assert.ok((await page.getByRole("dialog").textContent()).includes(version));
      await page.keyboard.press("Escape");
    }
  }
  assert.deepEqual(errors, []);
  console.log("Browser layout passed: long live versions and design samples, grid/list, 320–1448px.");
} finally {
  await browser.close();
}
