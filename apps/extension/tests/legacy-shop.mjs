import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

// Run against a local backend seeded with the bundled-example contract fixture.
// Build dist before running this opt-in check against its default local backend.
const api = 'http://localhost:8080';
const catalog = await (await fetch(`${api}/themes`)).json();
assert.ok(Array.isArray(catalog), 'legacy catalog must be a bare array');
const sample = catalog.find(theme => theme.id === process.env.LEGACY_THEME_ID)
    || catalog.find(theme => theme.name === 'example theme');
assert.ok(sample, 'seed the bundled-example fixture before running');
assert.equal(typeof sample.id, 'string');
const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><h1 class="h2 mb-0">Controlled Moodle-like course</h1>');
});
await new Promise((done, reject) => {
    fixture.once('error', reject);
    fixture.listen(0, '127.0.0.1', done);
});
let context;
try {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium', headless: true,
        args: [`--disable-extensions-except=${resolve(app, 'dist')}`, `--load-extension=${resolve(app, 'dist')}`],
    });
    let [worker] = context.serviceWorkers();
    worker ||= await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).hostname;
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${fixture.address().port}`);
    const shop = await context.newPage();
    const browse = shop.waitForResponse(response => response.url() === `${api}/themes`);
    await shop.goto(`chrome-extension://${extensionId}/shop/shop.html`);
    assert.equal((await browse).status(), 200);
    const button = shop.locator(`button[data-id="${sample.id}"]`);
    await button.waitFor();
    await worker.evaluate(() => chrome.storage.local.set({ installedThemes: { themesBySite: {} } }));
    // Keep the controlled site active, as it is when the real toolbar popup opens.
    await page.bringToFront();
    await button.evaluate(element => element.click());
    await page.waitForFunction(() => getComputedStyle(document.querySelector('h1')).backgroundColor === 'rgb(51, 51, 51)');
    const installed = await worker.evaluate(async () =>
        (await chrome.storage.local.get('installedThemes')).installedThemes.themesBySite['127.0.0.1']);
    assert.equal(installed.id, sample.id);
    assert.deepEqual(installed.rules, (await (await fetch(`${api}/themes/${sample.id}`)).json()).rules);
    console.log(`Legacy Chromium browse/install passed; string ID ${sample.id}, stored rules and applied CSS verified on a controlled fixture.`);
} finally {
    await context?.close();
    await new Promise(done => fixture.close(done));
}
