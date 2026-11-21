import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.env.WEB_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1448, height: 1086 },
  });
  const errors = [];
  const downloads = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("download", (download) =>
    downloads.push(download.suggestedFilename()),
  );
  await page.goto(origin);
  const api = await page.evaluate(async () => {
    const response = await fetch("/api/themes?limit=12");
    return { status: response.status, body: await response.json() };
  });
  assert.equal(
    api.status,
    200,
    "real Go API must succeed through the web origin",
  );
  assert.ok(Array.isArray(api.body.items));
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.getByRole("status").waitFor({ state: "detached" });
  assert.equal(await page.getByRole("alert").count(), 0);
  assert.equal(await page.getByRole("article").count(), api.body.items.length);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").textContent(), "Skip to themes");
  assert.equal(
    await page
      .locator(":focus")
      .evaluate((element) => getComputedStyle(element).outlineStyle),
    "solid",
  );
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "main");
  await page.getByRole("button", { name: "HOW IT WORKS" }).click();
  await page.getByRole("dialog", { name: "How themes work" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });

  // A longer live traversal previously overflowed mobile with one button per
  // visited cursor. Exercise as many as the fixture supplies, up to ten pages.
  for (let step = 0; step < 9; step++) {
    const next = page.getByRole("button", { name: "Next", exact: true });
    if (await next.isDisabled()) break;
    await next.click();
    await page.getByRole("status").waitFor({ state: "detached" });
    assert.equal(await page.getByRole("alert").count(), 0);
  }
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 812 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `live pagination stays within ${width}px after repeated page navigation`,
    );
    assert.ok(
      (await page
        .getByRole("navigation", { name: "Theme pages" })
        .getByRole("button")
        .count()) <= 5,
    );
  }
  await page.setViewportSize({ width: 1448, height: 1086 });

  await page.goto(`${origin}/?preview=design`);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.getByRole("article").count(), 12);
  await page
    .getByRole("searchbox", { name: "Search themes, authors, or universities" })
    .fill("Emma");
  assert.equal(await page.getByRole("article").count(), 1);
  await page.getByRole("button", { name: "CLEAR FILTERS ×" }).click();
  await page
    .getByLabel("FILTER BY UNIVERSITY")
    .selectOption("Stanford University");
  assert.equal(await page.getByRole("article").count(), 1);
  await page.getByRole("heading", { name: "Aurora", exact: true }).waitFor();
  await page.getByRole("button", { name: "CLEAR FILTERS ×" }).click();
  await page.getByRole("button", { name: "Download Campus Modern" }).click();
  const dialog = page.getByRole("dialog", { name: "Campus Modern" });
  await dialog.waitFor();
  assert.match(await dialog.textContent(), /No theme file is included/);
  // Native modal focus must remain in the dialog and return to the trigger.
  for (let index = 0; index < 3; index++) {
    await page.keyboard.press("Tab");
    assert.ok(
      await page.evaluate(
        () =>
          !!document.activeElement?.closest("dialog") ||
          document.activeElement === document.body,
      ),
    );
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  assert.equal(
    await page.locator(":focus").getAttribute("aria-label"),
    "Download Campus Modern",
  );
  assert.deepEqual(downloads, []);
  await mkdir(".cache", { recursive: true });
  await page.goto(`${origin}/?preview=design`);
  await page.evaluate(() => document.fonts.ready);
  await page.locator("img").evaluateAll(async (images) => {
    await Promise.all(
      images.map(async (image) => {
        image.loading = "eager";
        await image.decode();
      }),
    );
  });
  await page.screenshot({ path: ".cache/design-desktop.png", fullPage: true });

  for (const mode of ["grid", "list"]) {
    await page
      .getByRole("button", {
        name: mode === "grid" ? "Grid view" : "List view",
      })
      .click();
    for (const width of [1448, 1080, 780, 510, 375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        `no ${mode} overflow at ${width}px`,
      );
    }
  }
  await page.getByRole("button", { name: "Grid view" }).click();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator(".source-note").click();
  await page.screenshot({ path: ".cache/design-mobile.png", fullPage: true });
  await page.reload();
  assert.equal(await page.getByRole("article").count(), 12);
  assert.deepEqual(errors, []);
  console.log(
    `Browser smoke passed: Go API through ${origin}; sample assets, search, filters, layout toggles, modal keyboard access, refresh and responsive layouts.`,
  );
} finally {
  await browser.close();
}
