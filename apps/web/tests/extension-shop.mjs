import assert from 'node:assert/strict';
import { readFile, access, mkdir } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer } from 'vite';
import { chromium } from 'playwright';

// Real website + unpacked MV3 extension, with a controlled API and Moodle page.
const web = fileURLToPath(new URL('..', import.meta.url));
const extension = resolve(web, '../extension');
const source = await readFile(resolve(web, '../../contracts/theme/fixtures/valid/editor-export.json'));
const portable = JSON.parse(source);
const theme = { ...portable, id: '9007199254740993' };
const moodle = '<!doctype html><meta name="keywords" content="moodle"><h1 class="course-title">Course</h1>';
const upstream = createHttpServer((req, res) => {
  if (req.url === '/course') {
    res.setHeader('Content-Type', 'text/html');
    return res.end(moodle);
  }
  res.setHeader('Content-Type', 'application/json');
  if (req.url.endsWith('/download')) {
    res.setHeader('Content-Disposition', `attachment; filename="theme-${theme.id}.json"`);
    return res.end(source);
  }
  res.end(JSON.stringify(req.url.startsWith('/api/themes?') ? { items: [theme], nextCursor: null } : theme));
});
let server;
let context;
try {
  await new Promise(done => upstream.listen(0, '127.0.0.1', done));
  const api = `http://127.0.0.1:${upstream.address().port}`;
  process.env.WEB_API_TARGET = api;
  server = await createServer({ root: web, server: { host: '127.0.0.1', port: 0, strictPort: false }, logLevel: 'error' });
  await server.listen();
  const shopOrigin = `http://127.0.0.1:${server.httpServer.address().port}`;
  for (const mode of ['development', 'production']) {
    const shopUrl = mode === 'development' ? `${shopOrigin}/` : 'https://themes.example.org/archive/';
    process.env.VITE_SHOP_URL = shopUrl;
    process.env.VITE_API_BASE_URL = 'https://uploads.example.org';
    await build({ root: extension, mode, logLevel: 'error' });
    await assert.rejects(access(resolve(extension, 'dist/shop/shop.html')));
    await assert.rejects(access(resolve(extension, 'dist/shop.js')));
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium', headless: true,
      args: [`--disable-extensions-except=${resolve(extension, 'dist')}`, `--load-extension=${resolve(extension, 'dist')}`],
    });
    await context.tracing.start({ screenshots: true, snapshots: true });
    await context.route('https://themes.example.org/**', route => route.fulfill({ contentType: 'text/html', body: moodle }));
    let [worker] = context.serviceWorkers();
    worker ||= await context.waitForEvent('serviceworker');
    // URL.origin is "null" for chrome-extension URLs in Node.
    const extensionOrigin = `chrome-extension://${new URL(worker.url()).hostname}`;
    const target = await context.newPage();
    await target.goto(`${api}/course`);
    const popup = await context.newPage();
    await target.bringToFront();
    await popup.goto(`${extensionOrigin}/popup/popup.html`);
    const opened = context.waitForEvent('page');
    await popup.locator('#browse_themes').evaluate(node => node.click());
    const shop = await opened;
    await shop.waitForURL(shopUrl);
    assert.equal(popup.url(), `${extensionOrigin}/popup/popup.html`);
    assert.equal(await popup.locator('#upload_theme').count(), 1);
    if (mode === 'development') {
      await shop.getByRole('link', { name: theme.name, exact: true }).click();
      const downloadEvent = shop.waitForEvent('download');
      await shop.getByRole('button', { name: 'Download theme JSON', exact: true }).click();
      const download = await downloadEvent;
      const path = await download.path();
      assert.deepEqual(await readFile(path), source);
      await target.bringToFront();
      // A fresh popup captures the intended Moodle tab after browsing.
      await popup.reload();
      const importEvent = context.waitForEvent('page');
      await popup.locator('#import_theme').evaluate(node => node.click());
      const view = await importEvent;
      await view.locator('#file:enabled').waitFor();
      await shop.bringToFront();
      await view.locator('#file').setInputFiles(path);
      await view.locator('#apply:enabled').waitFor();
      await view.locator('#apply').evaluate(node => node.click());
      await view.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Imported and applied'));
      await target.waitForFunction(() => getComputedStyle(document.querySelector('h1')).backgroundColor === 'rgb(18, 52, 86)');
      assert.notEqual(await shop.locator('h1').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(18, 52, 86)');
      const stored = await worker.evaluate(async () => (await chrome.storage.local.get('installedThemes')).installedThemes);
      assert.deepEqual(stored.themesBySite[portable.site], portable);
    }
    // Same hostname as the Moodle fixture, different origin. Even Moodle markers
    // and a stored enabled theme must not make the shop an application target.
    if (mode === 'development') await shop.goto(`${shopOrigin}/`);
    for (const page of [shop, popup]) {
      const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, page.url());
      const view = await context.newPage();
      await view.goto(`${extensionOrigin}/import/import.html?${new URLSearchParams({ tab: String(tabId), url: page.url() })}`);
      await view.waitForFunction(() => document.querySelector('#status').textContent.includes('Error'));
      assert.equal(await view.locator('#file').isDisabled(), true);
      await view.close();
    }
    await shop.bringToFront();
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'toggle_theme' }));
    await shop.reload();
    await shop.locator('h1').waitFor();
    assert.notEqual(await shop.locator('h1').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(18, 52, 86)');
    await context.close();
    context = undefined;
  }
  console.log('Shop migration passed: development + HTTPS production popup URLs, real catalog/download/import/apply, shop/extension target rejection, toggle/reload isolation, and retired embedded build.');
} catch (error) {
  await mkdir(resolve(web, '.cache/ci'), { recursive: true });
  await context?.tracing.stop({ path: resolve(web, '.cache/ci/extension-trace.zip') }).catch(console.error);
  throw error;
} finally {
  delete process.env.VITE_SHOP_URL;
  delete process.env.VITE_API_BASE_URL;
  delete process.env.WEB_API_TARGET;
  await context?.close();
  await server?.close();
  await new Promise(done => upstream.close(done));
  // Leave the unpacked extension usable with the developer's normal settings.
  await build({ root: extension, logLevel: 'error' });
}
