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

## Standalone website

The React website is built independently of the extension:

```bash
cd apps/web
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Browser requests use same-origin `/api` URLs;
Vite forwards them to port 8080 by default. The live catalog requires the
website API from issue #2 / PR #17, which must land before this web foundation
can run against the default branch's backend. The explicitly labeled
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
