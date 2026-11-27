# Reproduce the website-to-extension flow

This local release candidate supports catalog browsing, portable JSON downloads
and explicit extension import/application. Accounts, public submissions and
moderation are not implemented. The website never needs an installed extension
and never installs a theme directly.

## Fresh checkout and sample catalog

Use Git, Docker Desktop with Linux containers/Compose v2, Node 24.15 or later
in the Node 24 line, npm and Chrome. From a fresh checkout:

```powershell
git clone https://github.com/Aledinn/Moodle-theme-shop.git
cd Moodle-theme-shop
docker compose -f compose.local.yml up --build --wait --wait-timeout 180
node tools/seed-local-theme.mjs
cd apps/extension
npm ci
npm run build
cd ../..
```

The explicit seed command adds the shared editor-export sample to the local
database, retaining existing records (including an existing record with that ID).
It is a development helper, not a public upload endpoint. No Go installation is
needed on the host. The initial catalog otherwise starts empty.

Browse **http://127.0.0.1:8090**, open the sample details and download its JSON.
Opening **http://127.0.0.1:8090/themes/9007199254740993** directly and refreshing
also works. Try this in a browser without the extension: metadata, download and
the setup/import guidance are available. The design preview is illustrative and
does not supply downloadable themes.

For the extension popup to open this container website, build with the following
setting in `apps/extension` before loading it:

```powershell
$env:VITE_SHOP_URL = 'http://127.0.0.1:8090/'
npm run build
```

Load `apps/extension/dist` via `chrome://extensions` → **Developer mode** →
**Load unpacked**. Reload the extension after rebuilding. See the
[build URL settings](../README.md#extension-build-urls) for independently
configurable shop and development upload API URLs. The standalone website's
same-origin API uses [separate server settings](local-containers.md#settings).

## Choose a compatible target explicitly

The sample is deliberately targeted to **127.0.0.1**, exactly as recorded in
the shared export. Do not change an imported file's hostname to make it fit.
For a harmless local Moodle-like target, create this fixture outside the repository
in a temporary directory, as `index.html`:

```html
<!doctype html>
<meta name="keywords" content="moodle">
<h1 class="course-title">Local course fixture</h1>
```

Serve that directory on **127.0.0.1** at a different port from the shop, for
example using Python 3: `python -m http.server 18081 --bind 127.0.0.1`.
Visit **http://127.0.0.1:18081**. `localhost` is a different hostname and does not
match this sample. This fixture tests extension mechanics, not real Moodle
compatibility.

Return to that target tab, open the extension popup and choose **Import downloaded
JSON**. Select the downloaded file, review the metadata/hostname and explicitly
confirm application. Keep the target on the same document until confirmation;
switching active tabs is allowed. The sample turns the course heading background
to `#123456`. Open the editor to select the heading and change a supported color,
export JSON, toggle styling off/on and reload the same target to verify the change.

Malformed, unsafe, oversized or wrong-host files fail without replacing saved
themes. The import is tied to the captured tab and document: navigating, reloading,
closing or removing Moodle compatibility before confirmation requires reopening
import from the intended target. The configured shop origin and extension pages
are excluded even if they contain Moodle markers. Missing catalog records show
**Theme not found**; service errors offer **Try again**. Download errors never
report a completed handoff. Details and download use the live API, not an embedded
extension catalog.

## Automated reproduction and coverage

Install both apps' locked dependencies and Playwright Chromium, then run:

```powershell
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
npm run test:catalog
npm run test:details
npm run test:extension
npm run test:containers
```

Run these sequentially: extension browser checks rebuild the same `dist` directory.
`test:containers` creates its own isolated database and sample, builds the actual
website/API images, downloads from Nginx → Go → database, then runs the unpacked
extension import/apply/editor/export/toggle/reload journey on the compatible
fixture. It also uses an ordinary browser without an extension, checks details
navigation/refresh, stops/recreates the API and retries the failed details request.
It removes only its unique test project and volume.

| Acceptance area | Automated check |
| --- | --- |
| Catalog → details → JSON → explicit import/apply | `test:extension` with controlled API; `test:containers` with real Go/database |
| Visitors without an extension, attachment bytes, missing theme, API/download failure and retry | `test:details`; container ordinary-browser and outage checks |
| Invalid, oversized, unsafe and wrong-host import; changed/closed target | Extension `npm test` (`theme-import.mjs`), asserting storage stays unchanged |
| Editor, JSON export, toggle, saved rules and same-site reload | Complete downloaded-theme journey and extension import suite |
| Configurable development and production shop/API URLs | Extension build-config suite, development/HTTPS production popup tests and web proxy unit tests |
| Container deep links, refresh and independently configured API upstream | `test:containers`, web proxy tests and Compose Nginx configuration |

The website containers workflow runs these checks on relevant PRs. CI output
records representative pass summaries; failure traces and logs have seven-day
artifact retention. Raw local evidence and private notes are not source files.
See [CI verification](ci-verification.md) for database integration and release gates.

## Current limits

Theme objects persist in `chrome.storage.local`. Enablement, the selected editor
rule and injected-CSS bookkeeping live in service-worker memory. The checks prove
same-site reload within that worker lifetime; they do not promise automatic
enablement after worker suspension, extension reload or browser restart. Reopen
the editor/reselect the element and toggle or reimport as needed.

Enablement is tracked by hostname while CSS is injected per tab. Toggling or
editing one tab does not synchronize already-open same-host tabs, and their
appearance can differ until reload or explicit application. Simultaneous editing
and import in multiple tabs are not coordinated. No multi-tab or worker-restart
guarantee is claimed. Real university Moodle layouts, installation restrictions
and browser policies still require a human check on the intended compatible site.
