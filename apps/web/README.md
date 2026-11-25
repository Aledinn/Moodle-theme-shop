# Standalone website

React + TypeScript + Vite foundation for the Moodle Theme Shop. Use Node 24
(24.15 or later) and npm. This app has its own lockfile and builds independently
of the extension. The Go backend remains in `../backend`.

```powershell
cd apps/web
npm ci
npm run dev
```

Open **http://127.0.0.1:5173**. The development server uses a strict port and
binds to the local machine. The website is a single-page catalog following the
supplied Moodle Theme Archive design kit: condensed typography, cream paper,
red and cobalt accents, a compact cover banner, filter rail and four-column grid.
Guidance and metadata open in accessible dialogs; there is no authentication UI.

The [reusable design reference](../../docs/design/website-archive/README.md)
preserves the supplied visual target, specification and portable tokens for
future website work.

## Design samples and live catalog

- `/` uses the real Go API with bounded cursor pagination. Search, sorting and
  hostname filtering apply to the current page, as the interface states. The API
  does not yet supply screenshots, university affiliations or download counts;
  the UI does not invent them or attach sample thumbnails to live records.
- `/?preview=design` shows the 12 illustrative records and thumbnails supplied
  in the ZIP, explicitly labeled **Design preview**. This view is useful for
  comparing the implementation with the reference. Search, name/university and
  popularity filters, sort, curated selection, grid/list layout and page-size
  controls work locally. Sample download buttons explain that no file is included.
- The masthead links between the two modes. Sample content never enters the
  database and never substitutes for a failed API response.

The supplied assets are in `public/design/`; their provenance is recorded in
`public/design/ASSET_PROVENANCE.md`. Preview images are low-resolution reference
crops, not real theme packages. Anton and Barlow Condensed are hosted locally
with their OFL licenses in `public/design/fonts/`, so visiting the site does not
require Google Fonts. Tokens are kept in `src/design-tokens.css`; the supplied
starter styles and React integration refinements are separate stylesheets.

Theme details provide portable JSON downloads. Return to the intended Moodle tab and choose **Import downloaded JSON** in the extension popup.

## Catalog navigation

Live catalog cards display name, description, author, version and supported
hostname as text. Theme names link to stable `/themes/{id}` metadata pages;
IDs stay strings throughout, including values larger than JavaScript's safe
integer range. Details URLs work on direct navigation and refresh when the host
provides the SPA fallback described below.

Previous/Next and up to three page buttons use the server's opaque cursors. Each
request fetches only the selected page (12, 24 or 48 items); there is no catalog
prefetch. The previous successful page stays usable during loading and errors,
and its page number changes only after a successful response. Retry repeats the
failed request. Page controls prevent overlapping submissions. The last page
shows **End of results**. Pagination follows the backend's live traversal policy,
so changes to the dataset between requests can change page membership.

## Same-origin API

Start the Go backend and database with the repository's Docker Compose setup.
The browser always requests relative `/api/...` URLs. Vite forwards these
unchanged to `http://127.0.0.1:8080`: `/api/themes?limit=12` reaches Go as
`/api/themes?limit=12`, not `/themes?limit=12`.

To use another local backend, set a server-side environment variable before
starting Vite (or put it in an untracked `.env.local`):

```powershell
$env:WEB_API_TARGET = 'http://127.0.0.1:18080'
npm run dev
```

Use an HTTP(S) origin without paths or credentials. `WEB_API_TARGET` is read
only by Vite's Node configuration. Do not put secrets in `VITE_*` variables:
those are public browser build inputs. The website needs no CORS changes and
uses same-origin credentials. It does not copy the extension's absolute API URL.

The API client validates response shapes, preserves IDs/cursors as strings,
provides HTTP status/code/message errors, and accepts `AbortSignal`. The request
hook aborts on replacement/unmount and ignores late results from older requests.
API metadata is rendered as React text, never raw HTML.

## Checks

```powershell
npm ci
npm run typecheck
npm test
npm run build
# Self-contained Chromium check with curated local API responses:
npm run test:catalog
npm run test:details
# Cross-app migration check; install extension dependencies first:
npm run test:extension
# With the dev server and Go API running:
npx playwright install chromium
npm run test:smoke
# With the dev server running; uses controlled API responses, no Go API needed:
npm run test:layout
```

Unit/component checks cover response errors, malformed data, large IDs,
cancellation, stale results, page navigation, retry, literal text rendering,
sample/live isolation, filtering, sort, layout changes and sample download guidance.
The proxy test starts a real Vite server and a controlled HTTP upstream to assert
exact path/query forwarding and the configurable target. The browser smoke test
separately requires a successful real Go API response through the development
origin and checks both catalog modes, local image/font loading, search/filter
interactions, modal keyboard access, page refresh and grid/list mobile overflow.
The separate `test:catalog` check starts and stops its own Vite server and checks
long/hostile metadata at 320px, 375px and desktop widths, keyboard activation of
a details link, and details refresh. It does not require or verify a running Go
API or database. Component tests also cover retained pages, duplicate-request
prevention, a failed continuation and retry, and a stable three-page traversal.
Set `WEB_URL` to check a different dev port. Screenshots go to ignored `.cache/`.

`npm run build` writes static assets to `dist/`. `npm run preview` serves them
on port 4173 for static inspection; it does not provide an API proxy. Production
hosting must route `/api/*` to Go and other application routes to `index.html`.
Deployment packaging and production fallback verification are separate tickets.

## Theme details and downloads

`/themes/{id}` displays metadata as plain text, including unverified author,
release version and the exact supported hostname. Loading, missing themes and
service failures have explicit states and retry. Percent-encoded IDs are decoded
once for routing and encoded again for API requests, preserving string IDs.

**Download theme JSON** fetches `/api/themes/{id}/download` through the same-origin
API. The Go endpoint validates the portable contract and supplies a safe numeric
`theme-{id}.json` attachment filename. The browser adapter requires that attachment
header and JSON media type, bounds the stream to 256 KiB, and hands the original
bytes to the browser only after receiving the complete response. It does not
rebuild JSON from the metadata record. Failures offer retry; the handoff message
asks visitors to confirm saving in their browser, since the page cannot prove it.

Setup guidance links to extension build/load instructions and explains compatible
hostname selection, file import and explicit target confirmation/application.
The popup opens the website in a normal tab; return to Moodle before importing. Visitors can download without an
account or extension. The page never probes extension state or sends extension
messages.

`npm run test:details` starts Vite and a controlled HTTP upstream, checks the actual
same-origin proxy and browser download against the shared valid editor export,
and covers direct details navigation/refresh, keyboard activation, mobile widths,
literal hostile text, missing themes, server failures and retry. Unit tests also
preserve every valid shared portable fixture byte-for-byte and check bounded
streaming, unsafe attachment filenames, cancellation, duplicate clicks, failed
streams and failed browser handoff. The server remains responsible for contract
validation; passing these tests does not verify a real Moodle import/application.
Production API routing and SPA fallback verification remain packaging work.

`test:extension` builds and loads the unpacked extension in Chromium, opens this
website from its popup, browses a controlled API record, downloads its actual
JSON, returns to a Moodle fixture and imports/applies it. It checks development
and HTTPS production shop URLs, rejects shop/extension import targets, and verifies
that toggle/reload cannot style the shop. It requires `npm ci` in both apps and
the Playwright Chromium installation. It uses no live Moodle server or database.
