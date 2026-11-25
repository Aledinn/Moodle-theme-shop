# Local website and API containers

Requires Docker with Linux containers and Docker Compose v2. Run from the repository
root; Node and Go on the host are unnecessary for starting the stack.

```powershell
docker compose -f compose.local.yml up --build --wait --wait-timeout 180
docker compose -f compose.local.yml ps -a
docker compose -f compose.local.yml logs -f web backend bootstrap db
# Stop containers, retaining catalog data:
docker compose -f compose.local.yml down
```

Open **http://127.0.0.1:8090**. The initial catalog is empty. Nginx serves built
assets and forwards `/api` and `/api/*` unchanged to Go at `backend:8080` on the
Compose network. Direct `/themes/{id}` links and refresh return the website for
HTML navigation; missing assets return 404, and API status codes pass through.
The legacy `/themes` upload endpoint is deliberately not exposed by this origin.

This is a separate Compose project (`moodle-shop-local`), network and named volume
(`moodle-shop-local_local-db`). It can run alongside the original
`docker compose up` stack and Vite without using their ports or data. Only the
website is published, bound to loopback; neither Go nor the insecure local
CockroachDB exposes a host port. Do not use this configuration for public hosting.

Startup waits for the database SQL health check. The one-shot `bootstrap` service
runs the existing idempotent `apps/backend/migrations/001.sql` to create `mydb`
and `themes`, then Go starts. Website health checks require a successful catalog
API response. A successful `up --wait` means the API and schema are ready; inspect
`bootstrap` logs if startup fails. Subsequent starts retain data and can rerun the
bootstrap safely; this is not a general migration runner for future schema changes.
If CockroachDB reports clock skew after Docker Desktop resumes, synchronize the
host/VM clock (restart Docker Desktop if needed), then rerun `up`. Do not disable
the database clock checks or delete developer volumes to address a clock error.

## Settings

| Variable | Default | Where / purpose |
| --- | --- | --- |
| `WEB_PORT` | `8090` | Compose host port, always bound to `127.0.0.1` |
| `WEB_API_UPSTREAM` | `backend:8080` | Web container runtime `host:port`, set in Compose; Nginx uses Docker DNS, including after API container replacement |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | `db`, `26257`, `root`, empty, `mydb` | Fixed backend container environment matching the local bootstrap; host `PG*` variables are not inherited |

For another host port, set `$env:WEB_PORT = '18090'` in PowerShell before `up`
(POSIX shells: `WEB_PORT=18090 docker compose -f compose.local.yml up --build --wait`).
Use the same port setting for later commands. `WEB_API_TARGET` configures only
Vite development; it does not configure this image. No browser build variable
or browser `localhost` address is used for the API upstream. The web Dockerfile
pins Node 24 LTS and Nginx stable by version and digest, installs the checked-in
lockfile with `npm ci`, and copies only built assets into the serving stage.
Review [Node releases](https://nodejs.org/en/about/previous-releases) and
[Nginx stable releases](https://nginx.org/en/download.html) when updating the pins.

## Verify with fresh, isolated data

The automated check needs Node 24 and the website's locked dev dependencies and
Playwright Chromium. It builds the actual images, creates a unique Compose project
and volume with an automatically allocated loopback port, seeds one portable
fixture, and checks catalog browsing, direct details navigation/refresh, browser
download, query forwarding, asset misses, API errors, outage and recovery.
It removes only its own containers and volume in `finally`; developer data stays intact.

```powershell
cd apps/web
npm ci
npx playwright install chromium
npm run test:containers
```

For a manual check, start the stack above, visit the catalog, and fetch
`http://127.0.0.1:8090/api/themes?limit=12` (JSON),
`/api/themes/0` (404 JSON), `/api/themes?limit=0` (400 JSON), and
`/assets/missing.js` (404, never the app shell). With a record present, open
`/themes/{id}` directly, refresh, and use **Download theme JSON**. On an empty
catalog `/themes/0` still loads the app and displays **Theme not found**.
Use the automated isolated fixture check for a successful real download without
adding sample records to your developer database.

To diagnose API downtime, stop only this stack's backend with
`docker compose -f compose.local.yml stop backend`: `/api/themes` should return
502 (or 504 on connection timeout) while the website shell still loads. Restore it with
`docker compose -f compose.local.yml up -d backend`; DNS refresh can take five seconds.
Avoid `down --volumes` on a developer project unless intentionally discarding its data.
