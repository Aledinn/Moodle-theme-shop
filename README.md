# Moodle Theme Shop

Moodle Theme Shop is a work-in-progress proof of concept for a community-driven Moodle theme marketplace, combining a TypeScript Chrome extension for visually creating, applying, exporting, sharing, and installing custom Moodle themes with a Go API and CockroachDB-backed theme store.

The project is experimental, incomplete, and primarily intended for learning and validating the idea rather than production use.

Starting with commit `b7126a9`, all future commits will be AI-assisted to accelerate development and help achieve the project's intended goals.

## Installation

Make sure Docker, Node.js, and npm are installed.

Start the backend and database:

```bash
docker compose up --build
```

Build the Chrome extension:

```bash
cd apps/extension
npm install
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the `apps/extension/dist` directory.

The backend API will be available at `http://localhost:8080`.

The popup's **Browse themes on website** opens the standalone catalog in a normal
browser tab. Start the website as described below, browse and download a theme,
then return to the intended Moodle tab before opening **Import downloaded JSON**.
The embedded shop and its direct-install message have been retired.

### Extension build URLs

The extension reads two independent public build inputs from the environment or
Vite `.env.local` / `.env.production.local` files in `apps/extension`:

| Setting | Default | Purpose |
| --- | --- | --- |
| `VITE_SHOP_URL` | `http://127.0.0.1:5173` | Website opened by the popup; paths such as `/archive/` are supported |
| `VITE_API_BASE_URL` | `http://localhost:8080` | API base for the retained development upload (`POST /themes`) |

For example, from `apps/extension` in PowerShell:

```powershell
$env:VITE_SHOP_URL = 'https://themes.example.org/'
$env:VITE_API_BASE_URL = 'https://api.example.org'
npm.cmd run build
```

Use your own deployed hosts. URLs must use HTTPS, with HTTP allowed only for
`localhost`, `127.0.0.1`, or `[::1]`. Credentials, query strings and fragments are
rejected at build time. Both development and production modes support these
settings; production also defaults to local services until configured. Rebuild
and reload the unpacked extension after changing them. These values contain no
secrets. Website `/api` routing and its server-side `WEB_API_TARGET` remain
separate from both extension settings.

The configured shop origin and extension pages cannot be import/application
targets, even if they expose Moodle markers. Import uses the captured Moodle
tab and explicit confirmation; the website never messages the extension.
**Upload theme (development)** remains available against the separately configured
API. Public uploading awaits accounts and moderation.

## Import a downloaded theme

Open the intended Moodle page, open the extension popup, and choose **Import
downloaded JSON**. Keep that Moodle tab on the same page while selecting a file.
The import page retains its tab and document identity even if you switch to the
shop or another tab. Review the metadata and supported hostname, then choose
**Confirm import and apply to target** to replace that site's saved theme.

Imports accept the [portable contract](contracts/theme/README.md), including
valid legacy editor exports, up to 256 KiB and 500 rules. The hostname must match
exactly; import never rewrites it. Target pages must expose Moodle metadata
(`keywords`/`generator`) or the Moodle `page-*` body and `#page #page-content`
structure. Closed, navigated, reloaded, unsupported and incompatible targets
require reopening import from the intended Moodle tab. Validation failures leave
saved themes untouched. No additional extension permissions are needed.

Extension `npm ci`, typecheck, test and build commands generate static schema
validators from the shared schemas. This avoids runtime code generation, which
Chrome Manifest V3 forbids. `npm test` includes a real unpacked-extension check
using a local Moodle-like fixture; it never injects into university servers.

## Standalone website

The React website is built independently of the extension:

```bash
cd apps/web
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Browser requests use same-origin `/api` URLs;
Vite forwards them to port 8080 by default. The explicitly labeled
`/?preview=design` view uses only the supplied illustrative design samples.

See the [web setup and checks](apps/web/README.md) and
[reusable website design reference](docs/design/website-archive/README.md).

## Contributing with AI

See [CONTRIBUTING.md](CONTRIBUTING.md) for the issue, branch, PR and separate-review
workflow. [AGENTS.md](AGENTS.md) contains the shared project handbook; reusable
Codex procedures live in [.agents/skills](.agents/skills). GitHub issue and PR
templates collect scope, acceptance criteria, validation and review evidence.

## Project Status

The [portable theme contract and shared fixtures](contracts/theme/README.md) define
the download/import format, limits, CSS subset, API string IDs, and compatibility
policy. Run its Go and Chromium checks before changing the interchange format.

This project is currently a work in progress and serves as a proof of concept. Core features are functional, but the project is still experimental and may contain bugs, incomplete features, or breaking changes. It is not intended for production use yet.
