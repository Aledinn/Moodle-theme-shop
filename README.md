# Moodle Theme Shop

Moodle Theme Shop is a work-in-progress proof of concept for a community-driven Moodle theme marketplace, combining a TypeScript Chrome extension for visually creating, applying, exporting, sharing, and installing custom Moodle themes with a Go API and CockroachDB-backed theme store.

The project is experimental, incomplete, and primarily intended for learning and validating the idea rather than production use.

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

## Project Status

This project is currently a work in progress and serves as a proof of concept. Core features are functional, but the project is still experimental and may contain bugs, incomplete features, or breaking changes. It is not intended for production use yet.
