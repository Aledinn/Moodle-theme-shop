import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
await build({ root: app, logLevel: 'error' });
const legacy = await readFile(resolve(app, '../../contracts/theme/fixtures/valid/editor-export.json'), 'utf8');
// Same six-field projection returned by the website download endpoint, with
// repeated selectors to verify ordering/cascade survives import.
const download = JSON.parse(legacy);
download.name = 'Website download';
download.rules.push({ selector: 'h1.course-title', properties: { color: '#abcdef' } });
const fixture = createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html');
    response.end(request.url === '/shop' ? '<h1>Website shop</h1>' :
        '<!doctype html><meta name="keywords" content="moodle, course"><body id="page-course-view"><div id="page"><div id="page-content"><h1 class="course-title">Local course</h1></div></div></body>');
});
await new Promise(done => fixture.listen(0, '127.0.0.1', done));
const url = `http://127.0.0.1:${fixture.address().port}/course`;
let context;
try {
    context = await chromium.launchPersistentContext('', {
        channel: 'chromium', headless: true,
        args: [`--disable-extensions-except=${resolve(app, 'dist')}`, `--load-extension=${resolve(app, 'dist')}`],
    });
    let [worker] = context.serviceWorkers();
    worker ||= await context.waitForEvent('serviceworker');
    const extension = `chrome-extension://${new URL(worker.url()).hostname}`;
    const page = await context.newPage();
    await page.goto(url);
    const tabId = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, url);
    const installed = () => worker.evaluate(async () => (await chrome.storage.local.get('installedThemes')).installedThemes);
    async function openImport(targetId = tabId, targetUrl = url) {
        const view = await context.newPage();
        await view.goto(`${extension}/import/import.html?${new URLSearchParams({ tab: String(targetId), url: targetUrl })}`);
        await view.locator('#file:enabled').waitFor();
        return view;
    }
    const select = (view, content) => view.locator('#file').setInputFiles({ name: 'theme.json', mimeType: 'application/json', buffer: Buffer.from(content) });
    async function expectRejected(view, content) {
        const before = await installed();
        await select(view, content);
        await view.waitForFunction(() => /Error|SyntaxError|TypeError/.test(document.querySelector('#status').textContent));
        assert.equal(await view.locator('#apply').isDisabled(), true);
        assert.deepEqual(await installed(), before);
    }

    // Exercise the real popup entry, capturing the active Moodle tab before the
    // import page becomes active. Keep a website shop active during selection.
    const popup = await context.newPage();
    await page.bringToFront();
    await popup.goto(`${extension}/popup/popup.html`);
    const opened = context.waitForEvent('page');
    await popup.locator('#import_theme').evaluate(button => button.click());
    const view = await opened;
    await view.locator('#file:enabled').waitFor();
    assert.match(await view.locator('#target').textContent(), new RegExp(`127\\.0\\.0\\.1 \\(tab ${tabId}\\)`));
    const shop = await context.newPage();
    await shop.goto(url.replace('/course', '/shop'));
    await select(view, JSON.stringify(download));
    await view.locator('#apply:enabled').waitFor();
    assert.match(await view.locator('#preview').textContent(), /Website download/);
    assert.equal((await installed()).themesBySite['127.0.0.1'], undefined, 'preview must not install');
    await view.locator('#apply').evaluate(button => button.click());
    await view.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Imported and applied'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('h1')).backgroundColor === 'rgb(18, 52, 86)');
    assert.deepEqual((await installed()).themesBySite['127.0.0.1'], download);
    assert.notEqual(await shop.locator('h1').evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(18, 52, 86)');

    // Toggle, same-site reload, editor and export keep using the installed theme.
    await page.bringToFront();
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'toggle_theme' }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('h1')).backgroundColor !== 'rgb(18, 52, 86)');
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'toggle_theme' }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('h1')).backgroundColor === 'rgb(18, 52, 86)');
    await page.reload();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('h1')).backgroundColor === 'rgb(18, 52, 86)');
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'open_editor' }));
    await page.locator('#mts_select_element').waitFor();
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'chosen_element', selector: 'h1.course-title' }));
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'update_selected_style', property: 'background-color', value: '#654321' }));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('h1')).backgroundColor === 'rgb(101, 67, 33)');
    await popup.evaluate(() => chrome.runtime.sendMessage({ type: 'export_json' }));
    const file = await worker.evaluate(async () => {
        for (let attempt = 0; attempt < 100; attempt++) {
            const [download] = await chrome.downloads.search({ limit: 1, orderBy: ['-startTime'] });
            if (download) return download;
            await new Promise(done => setTimeout(done, 20));
        }
        throw new Error('No export download created');
    });
    assert.deepEqual(JSON.parse(decodeURIComponent(file.url.split(',').slice(1).join(','))), (await installed()).themesBySite['127.0.0.1']);

    const invalid = await openImport();
    for (const content of ['{', legacy.replace('#123456', 'url(https://example.com)'),
        JSON.stringify({ ...download, site: 'moodle.example.com' }),
        JSON.stringify({ ...download, site: 'localhost' }),
        JSON.stringify({ ...download, rules: Array(501).fill(download.rules[0]) }),
        JSON.stringify({ ...download, name: '<img src=x>' }),
        legacy.replace('"author":', '"name":"duplicate", "author":')]) {
        await expectRejected(invalid, content);
    }
    await invalid.evaluate(() => {
        window.fileReads = 0;
        const slice = File.prototype.slice;
        File.prototype.slice = function (...args) { window.fileReads++; return slice.apply(this, args); };
    });
    await expectRejected(invalid, ' '.repeat(262145));
    assert.equal(await invalid.evaluate(() => window.fileReads), 0, 'oversize rejected before reading');

    // Legacy export remains accepted; storage is unchanged until confirmation.
    await select(invalid, legacy);
    await invalid.locator('#apply:enabled').waitFor();
    await invalid.locator('#apply').click();
    await invalid.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Imported and applied'));
    assert.deepEqual((await installed()).themesBySite['127.0.0.1'], JSON.parse(legacy));

    // Validation is also enforced at the worker boundary, before any write.
    const beforeInvalid = await installed();
    const rejected = await invalid.evaluate(async ({ tabId, url, source }) => {
        const { target } = await chrome.runtime.sendMessage({ type: 'capture_import_target', tabId, url });
        return chrome.runtime.sendMessage({ type: 'import_theme', target, source });
    }, { tabId, url, source: legacy.replace('#123456', 'expression(evil)') });
    assert.equal(rejected.ok, false);
    assert.deepEqual(await installed(), beforeInvalid);

    // A browser injection rejection must reach the user and must not replace
    // the last saved theme. Exercise the actual worker error response path.
    const failedApply = await openImport();
    await select(failedApply, JSON.stringify(download));
    await failedApply.locator('#apply:enabled').waitFor();
    await worker.evaluate(() => {
        const original = chrome.scripting.insertCSS;
        chrome.scripting.insertCSS = async (...args) => {
            chrome.scripting.insertCSS = original;
            throw new Error('Controlled injection failure');
        };
    });
    const beforeFailure = await installed();
    await failedApply.locator('#apply').click();
    await failedApply.waitForFunction(() => document.querySelector('#status').textContent.includes('Controlled injection failure'));
    assert.deepEqual(await installed(), beforeFailure);
    await failedApply.close();

    for (const action of ['navigate', 'reload', 'incompatible', 'close']) {
        const target = await context.newPage();
        await target.goto(url + `?${action}`);
        const id = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, target.url());
        const pending = await openImport(id, target.url());
        await select(pending, JSON.stringify(download));
        await pending.locator('#apply:enabled').waitFor();
        const before = await installed();
        if (action === 'navigate') await target.goto(url.replace('127.0.0.1', 'localhost'));
        if (action === 'reload') await target.reload();
        if (action === 'incompatible') await target.evaluate(() => { document.querySelector('meta').remove(); document.body.id = ''; });
        if (action === 'close') await target.close();
        await pending.locator('#apply').click();
        await pending.waitForFunction(() => document.querySelector('#status').textContent.includes('Import was not completed'));
        assert.deepEqual(await installed(), before, `${action} must leave storage intact`);
        await pending.close();
        if (!target.isClosed()) await target.close();
    }

    // Opening import from a shop or extension tab cannot capture a Moodle target.
    for (const target of [shop, popup]) {
        const id = await worker.evaluate(async url => (await chrome.tabs.query({})).find(tab => tab.url === url).id, target.url());
        const rejectedView = await context.newPage();
        await rejectedView.goto(`${extension}/import/import.html?${new URLSearchParams({ tab: String(id), url: target.url() })}`);
        await rejectedView.waitForFunction(() => document.querySelector('#status').textContent.includes('Error'));
        assert.equal(await rejectedView.locator('#file').isDisabled(), true);
    }
    console.log('Real MV3 import passed: popup capture, website/legacy files, bounded reads, invalid input, explicit confirmation, shop-active selection, target navigation/reload/closure/incompatibility, storage, CSS, editor, toggle, reload and export.');
} finally {
    await context?.close();
    await new Promise(done => fixture.close(done));
}
