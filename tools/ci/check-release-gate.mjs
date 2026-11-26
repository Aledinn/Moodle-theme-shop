import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Mutate a disposable build context, never the checkout. No image push or load.
const root = fileURLToPath(new URL('../../', import.meta.url));
const context = await mkdtemp(join(tmpdir(), 'theme-release-gate-'));
try {
  await mkdir(join(context, 'apps/backend'), { recursive: true });
  for (const path of ['go.mod', 'go.sum', 'cmd', 'internal', 'migrations', 'dockerfile']) {
    await cp(join(root, 'apps/backend', path), join(context, 'apps/backend', path), { recursive: true });
  }
  await cp(join(root, 'contracts'), join(context, 'contracts'), { recursive: true });
  // A deployed validator that accepts every JSON object is a real import regression.
  await writeFile(join(context, 'apps/backend/internal/themecontract/portable.schema.json'), '{}\n');
  const result = spawnSync('docker', ['build', '--progress=plain', '--file', 'apps/backend/dockerfile', '.'], {
    cwd: context, encoding: 'utf8', timeout: 600_000, maxBuffer: 20 * 1024 * 1024,
  });
  const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  await mkdir(join(root, '.cache/ci'), { recursive: true });
  await writeFile(join(root, '.cache/ci/release-gate.log'), log);
  if (result.error) throw result.error;
  assert.notEqual(result.status, 0, 'a broken contract must block the default release build');
  assert.match(log, /FAIL: TestDeploymentSchemaMatchesContract/, 'failure must come from the contract test, not Docker setup');
  // Match the actual publication workflow: it must still build this Dockerfile.
  const workflow = await readFile(join(root, '.github/workflows/backend-image.yml'), 'utf8');
  assert.match(workflow, /context: \./);
  assert.match(workflow, /file: \.\/apps\/backend\/dockerfile/);
  assert.doesNotMatch(workflow, /target:/, 'publication must use the gated default release target');
  console.log('Broken portable validator rejected; default release image could not be produced.');
} finally {
  await rm(context, { recursive: true, force: true });
}
