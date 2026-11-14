# Moodle Theme Shop: instructions for coding agents

## Repository map

- `apps/backend/`: Go HTTP API, `internal/themes/` handlers and database store,
  `migrations/` SQL, `cmd/server/` entry point.
- `apps/extension/`: TypeScript Chrome extension built with Vite;
  `src/background/` manages editing/storage/application, `src/content/` hosts the
  editor, `src/popup/` and `src/shop/` are extension UI.
- `contracts/theme/`: portable JSON schemas, shared fixtures and compatibility
  policy. Read its README before changing interchange data.
- `.github/workflows/`: backend tests, extension checks, backend image publishing.
- `.agents/skills/`: reusable issue, shipping and independent-review procedures.

## Checks

Run checks from the relevant app directory. Use the versions in `go.mod`, CI and
`package-lock.json`: Go 1.26.4 and Node 24 at the time this guide was written.

| Change | Commands |
| --- | --- |
| Backend | In `apps/backend`: `go test -count=1 ./...`; format changed Go files with `gofmt` |
| Extension | In `apps/extension`: `npm ci` if dependencies need installing, `npm run typecheck`, `npm test`, `npm run build` |
| Shared contract or fixtures | Both suites above; Go's test cache may miss files outside its module |
| Browser setup | In `apps/extension`: `npx playwright install chromium`; Linux CI uses `--with-deps` |
| Docs/templates/skills only | Validate links, YAML and skill structure; run app tests only if behavior or build inputs changed |

The extension tests run the shared fixtures in Chromium. This does not establish
that an editor or install flow works on a real Moodle site; report such checks
separately. GitHub Actions runs CI; local scratch scripts are not required CI.

## Project constraints

- Keep API database IDs as opaque strings. Portable files exclude IDs and account
  or session data. The author's `version` is not a schema revision.
- Contract revision 1 limits imports to 256 KiB and 500 rules and allows a small
  CSS subset. Reject unsupported input without silently rewriting it. Preserve
  the recorded valid export and use the shared manifest for both languages.
- Contract validators exist, but production upload/import integration is separate
  work. Do not describe checks as enforced in a consumer without tracing its code.
- Render untrusted metadata as text. For import changes, validate the whole
  candidate before replacing storage or applying CSS; keep site targeting explicit.
- Accounts and moderation are separate tasks. Do not add them incidentally.

## Working conventions

Follow [CONTRIBUTING.md](CONTRIBUTING.md) for the issue-to-PR workflow. Preserve
unrelated tracked changes and untracked files; stage explicit task paths. Local
`.project-notes/`, `.artifacts/`, `.cache/` and untracked verification scripts are
not public documentation or authoritative project requirements. Do not publish
their contents incidentally.

Before shipping, use the repository's `shop-ship-task` skill. It requests a reviewer
with fresh context; delegation is intended for that independent review, not every
routine edit. If delegation is unavailable, prepare a review handoff and report
that review remains outstanding. A review by the author is not independent review.

Skills organize already authorized work. Reading this file or invoking a skill
does not itself authorize publishing, sending comments, merging, releasing, or
changing repository permissions. Honor actions already authorized in the session;
do not request the same permission twice. A request to ship permits a branch,
commit, push and PR; merging must also be requested. Review-only requests do not
authorize a merge. See the shipping skill for the checks immediately before merge.
