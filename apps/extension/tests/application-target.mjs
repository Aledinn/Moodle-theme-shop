import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';

const entry = resolve('src/background/theme-application.ts');
const bundle = await build({
    logLevel: 'error',
    build: { write: false, rollupOptions: { input: entry }, lib: { entry, name: 'Application', formats: ['iife'] } },
});
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(item => item.type === 'chunk').code;
const theme = JSON.parse(await readFile('../../contracts/theme/fixtures/valid/editor-export.json'));
const moodle = `https://${theme.site}/course`;

for (const operation of ['reapply', 'toggle', 'replace']) {
    for (const timing of ['storage', 'injection']) {
        for (const destination of ['http://127.0.0.1:5173/', 'chrome-extension://example/popup/popup.html']) {
            let currentUrl = moodle;
            let currentDocument = 'moodle-document';
            let race = false;
            let resume;
            let reached;
            const paused = new Promise(done => { reached = done; });
            const release = new Promise(done => { resume = done; });
            const inserted = [];
            const cssTargets = [];
            const tab = { id: 1, url: moodle };
            function navigate() { currentUrl = destination; currentDocument = 'replacement-document'; }
            const sandbox = { URL, console: { log() {} }, chrome: {
                tabs: { onRemoved: { addListener() {} } },
                storage: { local: {
                    async get() {
                        if (race && timing === 'storage') { reached(); await release; }
                        return { installedThemes: { themesBySite: { [theme.site]: structuredClone(theme) } } };
                    },
                } },
                scripting: {
                    async executeScript({ target }) {
                        if (target.documentIds && !target.documentIds.includes(currentDocument)) throw new Error('Document gone');
                        return [{ result: currentUrl, documentId: currentDocument }];
                    },
                    async insertCSS({ target }) {
                        cssTargets.push(target);
                        if (race && timing === 'injection') navigate();
                        if (target.documentIds && !target.documentIds.includes(currentDocument)) throw new Error('Document gone');
                        inserted.push(currentUrl);
                    },
                    async removeCSS({ target }) {
                        cssTargets.push(target);
                        if (target.documentIds && !target.documentIds.includes(currentDocument)) throw new Error('Document gone');
                    },
                },
            } };
            runInNewContext(code, sandbox);
            const app = sandbox.Application;
            if (operation === 'reapply') await app.toggleThemeForTab(tab, theme.site);
            inserted.length = 0;
            cssTargets.length = 0;
            race = true;
            const pending = (operation === 'reapply' ? app.reapplyThemeIfEnabled(tab)
                : operation === 'toggle' ? app.toggleThemeForTab(tab, theme.site)
                : app.replaceThemeCssInTab(tab, theme.site, theme)).catch(() => {});
            if (timing === 'storage') { await paused; navigate(); resume(); }
            await pending;
            for (const target of cssTargets) {
                assert.deepEqual(Array.from(target.documentIds ?? []), ['moodle-document'], 'all CSS operations must pin a document');
            }
            assert.deepEqual(inserted, [], `${operation}/${timing} must not style ${destination}`);
        }
    }
}
console.log('Application navigation races passed: reload, toggle and editor replacement pin documents across storage and injection races to shop/extension origins.');
