import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import Ajv from 'ajv';
import { build } from 'vite';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contract = resolve(app, '../../contracts/theme');
const portable = JSON.parse(await readFile(resolve(contract, 'fixtures/valid/editor-export.json'), 'utf8'));
portable.rules.push({ selector: portable.rules[0].selector, properties: { color: '#abcdef' } });
const validate = new Ajv().compile(JSON.parse(await readFile(resolve(contract, 'portable.schema.json'), 'utf8')));
const bundle = await build({
    configFile: false,
    logLevel: 'error',
    build: {
        write: false,
        lib: { entry: resolve(app, 'src/background/service-worker.ts'), name: 'ThemeWorker', formats: ['iife'] },
        minify: false,
    },
});
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(output => output.type === 'chunk').code;

async function waitFor(predicate) {
    const deadline = Date.now() + 5000;
    while (!predicate()) {
        assert.ok(Date.now() < deadline, 'service-worker operation did not finish');
        await setTimeout(10);
    }
}

// Exercise the actual install/edit/upload message handlers with Chrome and HTTP
// boundaries mocked. Storage clones values as chrome.storage does in the browser.
for (const installedFromShop of [false, true]) {
    const apiTheme = { ...structuredClone(portable), id: '9007199254740993', internal: 'do not upload' };
    let storage = { installedThemes: { themesBySite: installedFromShop ? {} : { [portable.site]: structuredClone(portable) } } };
    let onMessage;
    let applications = 0;
    let selectionComplete = false;
    const requests = [];
    runInNewContext(code, {
        URL,
        console: {
            log(message) { if (message === 'Selected selector:') selectionComplete = true; },
            warn() {}, error() {},
        },
        chrome: {
            runtime: { onMessage: { addListener(listener) { onMessage = listener; } } },
            tabs: {
                onUpdated: { addListener() {} },
                async query() { return [{ id: 7, url: `https://${portable.site}/course` }]; },
            },
            storage: { local: {
                async get() { return structuredClone(storage); },
                async set(value) { storage = structuredClone(value); },
            } },
            scripting: {
                async insertCSS() { applications++; },
                async removeCSS() {},
            },
        },
        async fetch(url, options) {
            if (!options) {
                assert.ok(url.endsWith(`/themes/${apiTheme.id}`));
                return { ok: true, async json() { return structuredClone(apiTheme); } };
            }
            requests.push({ url, ...options });
            return { ok: true, status: 201 };
        },
    });
    if (installedFromShop) {
        onMessage({ type: 'install_theme', id: apiTheme.id });
        await waitFor(() => applications === 1);
        assert.equal(storage.installedThemes.themesBySite[portable.site].id, apiTheme.id);
    }
    const selector = portable.rules[0].selector;
    onMessage({ type: 'chosen_element', selector });
    await waitFor(() => selectionComplete);
    const previousApplications = applications;
    onMessage({ type: 'update_selected_style', property: 'color', value: '#123456' });
    await waitFor(() => applications === previousApplications + 1);
    const beforeUpload = structuredClone(storage);
    onMessage({ type: 'upload_theme' });
    await waitFor(() => requests.length === 1);
    const request = requests[0];
    const uploaded = JSON.parse(request.body);
    const expected = structuredClone(portable);
    expected.rules[0].properties.color = '#123456';
    assert.deepEqual(uploaded, expected, 'upload must preserve all six fields and edited rule order');
    assert.equal(validate(uploaded), true, JSON.stringify(validate.errors));
    assert.equal(request.method, 'POST');
    assert.ok(request.url.endsWith('/themes'));
    assert.equal(request.headers['Content-Type'], 'application/json');
    assert.deepEqual(storage, beforeUpload, 'upload must not remove internal fields from installed storage');
}
console.log('Fresh and installed theme edit/upload passed; portable payload and unchanged storage verified.');
