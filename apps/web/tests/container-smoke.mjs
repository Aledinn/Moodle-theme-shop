import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const project = `moodle-shop-check-${randomUUID().slice(0, 8)}`;
const args = ["compose", "-f", "compose.local.yml", "-p", project];
function compose(command, { input, capture = false } = {}) {
  return execFileSync("docker", [...args, ...command], {
    cwd: root,
    env: { ...process.env, WEB_PORT: "0" },
    input,
    encoding: "utf8",
    stdio: capture ? ["pipe", "pipe", "inherit"] : ["pipe", "inherit", "inherit"],
    timeout: 600_000,
  });
}

let browser;
let page;
try {
  compose(["up", "--build", "--wait", "--wait-timeout", "180"]);
  const port = compose(["port", "web", "8080"], { capture: true }).trim().split(":").at(-1);
  const origin = `http://127.0.0.1:${port}`;
  const get = (path, options) => fetch(`${origin}${path}`, { signal: AbortSignal.timeout(15_000), ...options });
  const empty = await get("/api/themes?limit=12");
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { items: [], nextCursor: null }, "fresh volume starts empty");

  const fixture = JSON.parse(await readFile(new URL("../../../contracts/theme/fixtures/valid/editor-export.json", import.meta.url), "utf8"));
  // Exercise the documented fresh-checkout seeder, scoped to this test project.
  for (let attempt = 0; attempt < 2; attempt++) {
    execFileSync(process.execPath, [fileURLToPath(new URL('../../../tools/seed-local-theme.mjs', import.meta.url))], {
      cwd: root,
      env: { ...process.env, COMPOSE_PROJECT_NAME: project, WEB_PORT: '0' },
      stdio: 'inherit',
      timeout: 30_000,
    });
  }
  const id = "9007199254740993";
  const catalog = await (await get("/api/themes?limit=1")).json();
  assert.equal(catalog.items[0].id, id);
  assert.equal(catalog.nextCursor, null, 'repeated seeding keeps one sample');
  const download = await get(`/api/themes/${id}/download`);
  assert.equal(download.status, 200);
  assert.match(download.headers.get("content-type"), /application\/json/);
  assert.match(download.headers.get("content-disposition"), new RegExp(`theme-${id}\\.json`));
  const bytes = Buffer.from(await download.arrayBuffer());
  assert.deepEqual(JSON.parse(bytes), fixture);

  for (const [path, status] of [["/api/themes?limit=0", 400], ["/api/themes/0", 404], ["/api/themes/0/download", 404]]) {
    const response = await get(path, { headers: { Accept: "text/html" } });
    assert.equal(response.status, status, path);
    assert.match(response.headers.get("content-type"), /application\/json/);
    assert.ok((await response.json()).error);
  }
  for (const path of ["/assets/missing.js", "/assets/missing", "/design/missing", "/missing.css", "/themes/missing.js"]) {
    assert.equal((await get(path, { headers: { Accept: "text/html" } })).status, 404, path);
  }
  assert.equal((await get("/themes/123", { headers: { Accept: "application/json" } })).status, 404);
  assert.equal((await get("/themes/123", { method: "POST", headers: { Accept: "text/html" } })).status, 404);

  browser = await chromium.launch();
  page = await browser.newPage();
  await page.context().tracing.start({ screenshots: true, snapshots: true });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(origin);
  await page.getByRole("link", { name: fixture.name, exact: true }).waitFor();
  await page.goto(`${origin}/themes/${id}`);
  await page.getByRole("heading", { name: fixture.name, exact: true }).waitFor();
  await page.reload();
  await page.getByRole("heading", { name: fixture.name, exact: true }).waitFor();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download theme JSON", exact: true }).click();
  const file = await downloading;
  assert.equal(file.suggestedFilename(), `theme-${id}.json`);
  assert.equal(await file.failure(), null);
  assert.deepEqual(await readFile(await file.path()), bytes);
  await page.getByText('Import downloaded JSON', { exact: false }).first().waitFor();
  assert.deepEqual(errors, []);

  // Download from the actual container API and import into a real unpacked MV3
  // extension on a separate, explicitly compatible 127.0.0.1 Moodle fixture.
  execFileSync(process.execPath, [fileURLToPath(new URL('extension-shop.mjs', import.meta.url))], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, FLOW_SHOP_URL: origin },
    stdio: 'inherit',
    timeout: 180_000,
  });

  execFileSync(process.execPath, [fileURLToPath(new URL("browser-smoke.mjs", import.meta.url))], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    env: { ...process.env, WEB_URL: origin },
    stdio: "inherit",
    timeout: 120_000,
  });

  // Recreating Go exercises Docker DNS resolution as well as outage behavior.
  compose(["stop", "backend"]);
  assert.ok([502, 504].includes((await get("/api/themes")).status), "API outage stays a gateway error");
  assert.equal((await get("/themes/123", { headers: { Accept: "text/html" } })).status, 200);
  await page.reload();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.getByRole('button', { name: 'Download theme JSON', exact: true }).count(), 0);
  compose(["up", "-d", "--no-deps", "--force-recreate", "backend"]);
  let recovered = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if ((await get("/api/themes?limit=1")).status === 200) { recovered = true; break; }
    await setTimeout(1000);
  }
  assert.ok(recovered, "API recovers after container replacement without restarting Nginx");
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await page.getByRole('heading', { name: fixture.name, exact: true }).waitFor();
  console.log(`Container smoke passed: ${project}; fresh DB, catalog, details refresh, download, errors, assets, outage and recovery.`);
} catch (error) {
  await mkdir(".cache/ci", { recursive: true });
  try {
    await writeFile(".cache/ci/containers.log", compose(["logs", "--no-color", "--tail=150"], { capture: true }));
    await page?.screenshot({ path: ".cache/ci/container-failure.png", fullPage: true });
    await page?.context().tracing.stop({ path: ".cache/ci/container-trace.zip" });
  } catch (diagnosticError) {
    console.error("Could not collect all container diagnostics:", diagnosticError);
  }
  throw error;
} finally {
  await browser?.close();
  // Only this invocation's randomly named project and volume are removed.
  compose(["down", "--volumes"]);
}
