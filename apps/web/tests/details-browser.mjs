import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "vite";
import { chromium } from "playwright";

// Controlled upstream exercises the real development proxy, not a Go/database instance.
const id = "9007199254740993";
const bytes = await readFile(new URL("../../../contracts/theme/fixtures/valid/editor-export.json", import.meta.url));
const portable = JSON.parse(bytes);
const hostile = "<img src=x onerror=alert(1)>";
const theme = { ...portable, id, name: hostile, author: hostile, description: hostile + "LongMetadata".repeat(100), version: hostile };
let detailStatus = 200;
let downloadStatus = 200;
const paths = [];
const upstream = createHttpServer((request, response) => {
  paths.push(request.url);
  response.setHeader("Content-Type", "application/json");
  const downloading = request.url === `/api/themes/${id}/download`;
  const status = downloading ? downloadStatus : detailStatus;
  response.statusCode = status;
  if (status !== 200) return response.end(JSON.stringify({ error: { code: "test_failure", message: "Please retry the theme service." } }));
  if (downloading) {
    response.setHeader("Content-Disposition", `attachment; filename="theme-${id}.json"`);
    return response.end(bytes);
  }
  response.end(JSON.stringify(theme));
});
let server;
let browser;
try {
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  process.env.WEB_API_TARGET = `http://127.0.0.1:${upstream.address().port}`;
  server = await createServer({ server: { host: "127.0.0.1", port: 0, strictPort: false }, logLevel: "silent" });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/themes/${id}`);
  await page.getByRole("heading", { name: hostile, exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: hostile, exact: true }).waitFor();
  assert.equal(await page.locator('img[src="x"], script:not([type="module"])').count(), 0);
  assert.ok(await page.getByText("JSON file import is not available", { exact: false }).isVisible());
  for (const width of [320, 375, 780, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `details fit ${width}px`);
  }
  // Download control must be reachable and activated entirely by keyboard.
  await page.reload();
  const button = page.getByRole("button", { name: "Download theme JSON", exact: true });
  await button.waitFor();
  let reached = false;
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press("Tab");
    if (await button.evaluate((element) => element === document.activeElement)) { reached = true; break; }
  }
  assert.ok(reached, "download is keyboard reachable");
  const downloaded = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  const file = await downloaded;
  assert.equal(file.suggestedFilename(), `theme-${id}.json`);
  assert.equal(await file.failure(), null);
  assert.deepEqual(await readFile(await file.path()), bytes, "portable fixture bytes survive proxy and browser download");
  await page.getByText(/Download handed to your browser/).waitFor();
  assert.ok(paths.includes(`/api/themes/${id}/download`));
  // Failed download never creates a file or leaves the previous success visible.
  let unexpectedDownload = false;
  page.on("download", () => { unexpectedDownload = true; });
  downloadStatus = 500;
  await button.click();
  await page.getByRole("alert").filter({ hasText: "Download failed" }).waitFor();
  assert.equal(await page.getByText(/Download handed/).count(), 0);
  assert.equal(unexpectedDownload, false);
  for (const status of [404, 500]) {
    detailStatus = status;
    await page.reload();
    await page.getByRole("alert").waitFor();
    assert.equal(await button.count(), 0);
    if (status === 404) assert.ok((await page.getByRole("alert").textContent()).includes("Theme not found"));
    detailStatus = 200;
    await page.getByRole("button", { name: "Try again" }).click();
    await button.waitFor();
  }
  await page.setViewportSize({ width: 375, height: 900 });
  await mkdir(".cache", { recursive: true });
  await page.screenshot({ path: ".cache/issue-5-details-mobile.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log("Details Chromium checks passed: same-origin attachment, exact fixture bytes, keyboard, mobile, refresh, 404/500, retry, and failed download.");
} finally {
  await browser?.close();
  await server?.close();
  await new Promise((resolve) => upstream.close(resolve));
}
