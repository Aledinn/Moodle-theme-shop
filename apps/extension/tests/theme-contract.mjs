import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { build } from 'vite';
import { chromium } from 'playwright';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const root = resolve(app, '../../contracts/theme');
const manifest = JSON.parse(await readFile(resolve(root, 'fixtures/manifest.json'), 'utf8'));
assert.ok(manifest.cases.length > 0);
const files = await readdir(resolve(root, 'fixtures'), { recursive: true, withFileTypes: true });
const listed = new Set(manifest.cases.map(c => c.file));
for (const file of files.filter(f => f.isFile() && f.name !== 'manifest.json')) {
    const path = resolve(file.parentPath, file.name).slice(root.length + 1).replaceAll('\\', '/');
    assert.ok(listed.has(path), `Unlisted fixture: ${path}`);
}
const bundle = await build({
    configFile: false,
    logLevel: 'error',
    build: {
        write: false,
        lib: { entry: resolve(app, 'src/shared/portable-theme.ts'), name: 'ThemeContract', formats: ['iife'] },
        minify: false,
    },
});
const code = (Array.isArray(bundle) ? bundle[0] : bundle).output.find(o => o.type === 'chunk').code;
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage();
    await page.addScriptTag({ content: code });
    for (const c of manifest.cases) {
        const bytes = [...await readFile(resolve(root, c.file))];
        const result = await page.evaluate(({ bytes, kind }) => {
            const input = new Uint8Array(bytes);
            let value, error;
            try { value = ThemeContract.validateThemeBytes(input, kind, document); }
            catch (e) { error = String(e); }
            return { valid: error === undefined, error, value, unchanged: input.every((b, i) => b === bytes[i]) };
        }, { bytes, kind: c.kind });
        assert.equal(result.valid, c.valid, `${c.file}: ${result.error ?? 'unexpected acceptance'}`);
        assert.ok(result.unchanged, `${c.file}: input mutated`);
        if (c.valid) assert.deepEqual(result.value, JSON.parse(Buffer.from(bytes).toString('utf8')), 'No defaulting or rewriting');
        if (c.file.endsWith('large-string-id.json')) assert.equal(result.value.id, '9007199254740993');
    }
    const editor = await readFile(resolve(root, 'fixtures/valid/editor-export.json'), 'utf8');
    const edge = await page.evaluate(source => {
        const input = new TextEncoder().encode(source.padEnd(262144, ' '));
        ThemeContract.validateThemeBytes(input, 'portable', document);
        let oversized = false, parsed = false, browserFailure = false;
        try { ThemeContract.validateThemeBytes(new Uint8Array([...input, 32])); } catch { oversized = true; }
        try {
            ThemeContract.validateThemeBytes(input, 'portable', { querySelector() { parsed = true; throw new Error('browser parse failure'); } });
        } catch { browserFailure = true; }
        return { oversized, parsed, browserFailure };
    }, editor);
    assert.deepEqual(edge, { oversized: true, parsed: true, browserFailure: true });
    console.log(`Passed ${manifest.cases.length} shared fixtures in Chromium; byte boundary and browser rejection checks passed.`);
} finally { await browser.close(); }
