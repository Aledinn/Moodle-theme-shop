import assert from 'node:assert/strict';
import { resolveConfig } from 'vite';

// Resolve the real build configuration in both supported modes. Invalid inputs
// must fail before producing an extension that opens an unsafe or unusable URL.
const previousShop = process.env.VITE_SHOP_URL;
const previousApi = process.env.VITE_API_BASE_URL;
try {
  delete process.env.VITE_SHOP_URL;
  delete process.env.VITE_API_BASE_URL;
  for (const mode of ['development', 'production']) {
    const config = await resolveConfig({ mode, logLevel: 'silent' }, 'build');
    assert.equal(JSON.parse(config.define['import.meta.env.VITE_SHOP_URL']), 'http://127.0.0.1:5173/');
    assert.equal(JSON.parse(config.define['import.meta.env.VITE_API_BASE_URL']), 'http://localhost:8080');
    process.env.VITE_SHOP_URL = 'https://themes.example.org/archive/';
    process.env.VITE_API_BASE_URL = 'https://api.example.org/v1/';
    const configured = await resolveConfig({ mode, logLevel: 'silent' }, 'build');
    assert.equal(JSON.parse(configured.define['import.meta.env.VITE_SHOP_URL']), 'https://themes.example.org/archive/');
    assert.equal(JSON.parse(configured.define['import.meta.env.VITE_API_BASE_URL']), 'https://api.example.org/v1');
    delete process.env.VITE_SHOP_URL;
    delete process.env.VITE_API_BASE_URL;
  }
  for (const setting of ['VITE_SHOP_URL', 'VITE_API_BASE_URL']) {
    for (const value of ['', 'not a URL', 'javascript:alert(1)', 'http://public.example.org', 'https://user:password@example.org', 'https://example.org/?token=secret', 'https://example.org/#fragment']) {
      process.env[setting] = value;
      await assert.rejects(resolveConfig({ logLevel: 'silent' }, 'build'), undefined, `${setting}: ${value}`);
    }
    process.env[setting] = 'https://example.org/path/';
    await resolveConfig({ logLevel: 'silent' }, 'build');
    delete process.env[setting];
  }
  console.log('Build URL defaults, independent settings, HTTPS paths and unsafe input rejection passed.');
} finally {
  if (previousShop === undefined) delete process.env.VITE_SHOP_URL;
  else process.env.VITE_SHOP_URL = previousShop;
  if (previousApi === undefined) delete process.env.VITE_API_BASE_URL;
  else process.env.VITE_API_BASE_URL = previousApi;
}
