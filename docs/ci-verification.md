# CI verification

Pull requests and pushes to `main` run verification only: no image publication,
deployment, university access, account or personal data is needed. Changes to
the workflows and `tools/ci/` trigger all verification workflows. Backend,
extension and website changes trigger their consumers; shared contract changes
trigger all three. Compose and root Docker context changes trigger backend and
container verification.

Use Go from `apps/backend/go.mod`, Node 24, Docker with Compose v2, and the locked
npm dependencies. Playwright is exactly `1.65.0` in both npm lockfiles; install its
matching Chromium with `npx playwright install chromium` from each app (Linux CI
uses `--with-deps`). Do not substitute a system Chrome installation.

From the repository root, in Bash (Linux or a Docker-enabled WSL environment):

```bash
bash tools/ci/backend-tests.sh
```

This starts a pinned CockroachDB container on an allocated loopback port, waits
at most 30 attempts (each SQL probe is limited to five seconds), and runs
`go test -count=1 -timeout=3m -v ./...` with `TEST_DATABASE_URL` set. Integration
tests create unique databases, initialize the real table migration, traverse the
API and exercise every shared import fixture through upload, persistence and
download. Invalid imports must leave the database unchanged. The container is
removed on exit. Without `TEST_DATABASE_URL`, direct Go tests skip these database
checks; that is not equivalent to CI.

Run the other jobs locally (these commands also work from PowerShell):

```bash
cd apps/extension
npm ci
npx playwright install chromium
npm run typecheck
npm test
npm run build
cd ../web
npm ci
npx playwright install chromium
npm run typecheck
npm test
npm run build
npm run test:extension
npm run test:catalog
npm run test:details
npm run test:containers
cd ../..
node tools/ci/check-release-gate.mjs
```

`test:extension` uses an unpacked MV3 extension, local HTTP API/Moodle fixtures,
an ephemeral browser profile and allocated ports. It downloads, imports and
applies a deterministic shared theme, checks captured-tab targeting and prevents
application to the shop itself. The production shop URL is intercepted locally;
it never contacts the example host. This does not establish compatibility with
a real university Moodle installation.

`test:containers` builds the production website and backend and tests them through
the Nginx origin with fresh initialized data, browser downloads, deep-link refresh,
API errors, outage and recovery. It also runs the complete unpacked-extension
journey against the real container download, including editor/export/toggle and
saved-rule reload. Install extension dependencies before this check and run the
commands sequentially because browser checks rebuild the same extension output.
Each invocation uses a unique Compose project,
volume and host port and removes only those resources.

The [complete flow walkthrough](complete-flow.md) maps acceptance areas to the
checks and records the current multi-tab and service-worker limitations. Website
CI also runs the catalog/details browser suites without an installed extension;
extension CI covers rejected imports and stale or incompatible target documents.

The backend Dockerfile now takes the **repository root** as context:

```bash
docker build -f apps/backend/dockerfile .
```

The default release stage copies its binary from the test stage, forcing Go unit,
HTTP and shared-contract tests to pass before an image can be produced. Database
integration is enforced by the separate backend CI job. Both Compose files and
the tag/manual publishing workflow use this same Dockerfile and context. PR
verification never invokes the publishing workflow.

`check-release-gate.mjs` copies only source/contract inputs to a temporary context
and replaces the deployed portable schema with `{}` (a validator that accepts
invalid objects). It requires the **default release build to fail at
`TestDeploymentSchemaMatchesContract`**; a Docker startup/network failure does
not count. It never pushes or loads an image and never mutates the checkout.
The positive container build and this negative control prove both directions of
the publication test gate on every relevant PR.

Failure diagnostics live only under `.cache/ci/` (backend tests, disposable DB
logs, release-gate output) and `apps/web/.cache/ci/` (fixture-only Playwright traces,
screenshots and Compose logs). Actions uploads these explicit directories only
on failure, with seven-day retention and names unique to each run/attempt.
No environment dump, browser user profile, Docker credentials, `.env` or developer
database is uploaded. The root `.dockerignore` admits only backend source and
shared contract inputs. Inspect a trace with
`npx playwright show-trace .cache/ci/extension-trace.zip` from `apps/web`.
