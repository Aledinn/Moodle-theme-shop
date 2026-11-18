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
This single-page direction supersedes the original multi-route UI design in
issue #3. Separate detail/install routes are not implemented, so this foundation
is related work rather than a claim that all of #3 is complete.

The live API requires issue #2 / PR #17. Until that dependency lands, the backend
on `main` does not expose the `/api/themes` routes. Run the API branch locally or
use the self-contained design sample view for visual review.

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

Downloads and file import remain separate work in progress.

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
# With the dev server and Go API running:
npx playwright install chromium
npm run test:smoke
```

Unit/component checks cover response errors, malformed data, large IDs,
cancellation, stale results, page navigation, retry, literal text rendering,
sample/live isolation, filtering, sort, layout changes and sample download guidance.
The proxy test starts a real Vite server and a controlled HTTP upstream to assert
exact path/query forwarding and the configurable target. The browser smoke test
separately requires a successful real Go API response through the development
origin and checks both catalog modes, local image/font loading, search/filter
interactions, modal keyboard access, page refresh and grid/list mobile overflow.
Set `WEB_URL` to check a different dev port. Screenshots go to ignored `.cache/`.

`npm run build` writes static assets to `dist/`. `npm run preview` serves them
on port 4173 for static inspection; it does not provide an API proxy. Production
hosting must route `/api/*` to Go and other application routes to `index.html`.
Deployment packaging and production fallback verification are separate tickets.
