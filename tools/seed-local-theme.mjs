import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Explicit opt-in development sample, never automatic production seeding.
const root = fileURLToPath(new URL('../', import.meta.url));
const theme = JSON.parse(await readFile(new URL('../contracts/theme/fixtures/valid/editor-export.json', import.meta.url), 'utf8'));
const quote = value => `'${value.replaceAll("'", "''")}'`;
const values = [theme.name, theme.site, theme.author, theme.description, theme.version, JSON.stringify(theme.rules)].map(quote);
execFileSync('docker', ['compose', '-f', 'compose.local.yml', 'exec', '-T', 'db',
  '/cockroach/cockroach', 'sql', '--insecure', '--database=mydb'], {
  cwd: root,
  input: `INSERT INTO themes (id, name, site, author, description, version, rules)
    VALUES (9007199254740993, ${values.join(', ')}) ON CONFLICT (id) DO NOTHING;`,
  stdio: ['pipe', 'inherit', 'inherit'],
  timeout: 30_000,
});
console.log('Local sample ready: /themes/9007199254740993; compatible hostname: 127.0.0.1. Existing records were retained.');
