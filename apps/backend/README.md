# Backend API

`POST /themes` accepts the six-field [portable theme object](../../contracts/theme/README.md).
The complete request is limited to 262,144 bytes (including trailing whitespace),
even when streamed without a Content-Length. Oversized bodies return 413;
malformed/trailing JSON, duplicate or unknown fields, invalid metadata/hostnames,
and unsupported rules/CSS return 400 with a plain-text error. Validation completes
before any insert. All fields are required, including `description` and `version`;
the server no longer defaults empty versions. Valid editor exports keep their
values and rule order, and success still returns 201 with the created theme and
its string `id`. This validation adds no accounts or moderation controls.

Website routes:

- `GET /api/themes?limit=20&cursor=...` returns metadata as
  `{ "items": [...], "nextCursor": null }`. The default limit is 20; valid limits
  are integers from 1 to 100. Pass a non-null `nextCursor` unchanged on the next
  request. Empty pages use `items: []` and the last page uses `nextCursor: null`.
- `GET /api/themes/{id}` returns metadata, a string `id`, and ordered `rules`.
- `GET /api/themes/{id}/download` returns a JSON attachment named
  `theme-{id}.json`, containing only `name`, `site`, `author`, `description`,
  `version`, and `rules`. The complete serialized file is checked against the
  [portable contract](../../contracts/theme/README.md) before sending. Invalid
  stored development content returns a JSON error, never a partial attachment.

Pages use ascending database primary-key order and fetch one extra row to detect
continuation. Cursors are versioned URL-safe base64 tokens containing the last
ID as text. Clients must treat IDs and cursors as opaque strings. The present
CockroachDB backend accepts canonical nonnegative decimal IDs within INT8 range;
malformed/out-of-range IDs return 400, missing numeric IDs return 404.
Pagination is a live traversal, not a database snapshot: later inserts above the
cursor can appear, and deleted records disappear. Existing IDs do not change.

New API errors consistently use
`{ "error": { "code": "invalid_id", "message": "..." } }` with the relevant
HTTP status. Invalid limits/cursors return 400; unsupported methods return 405
with `Allow: GET`; database failures return 500 without database details.
Repeated pagination parameters and empty cursors are rejected.

The extension continues using `GET /themes` (a bare metadata array),
`GET /themes/{id}` (a theme record), and the existing development `POST /themes`.
Malformed IDs on legacy detail requests also return 400. This does not introduce
publication controls: use curated fixtures locally; the development upload is
not a public publication API.

## Verification

From `apps/backend`:

```powershell
go test -count=1 ./...
docker run -d --name theme-api-db -p 127.0.0.1:26259:26257 cockroachdb/cockroach:v25.4.17 start-single-node --insecure --store=type=mem,size=1GiB
# Wait until this succeeds before running integration checks:
docker exec theme-api-db cockroach sql --insecure --execute='SELECT 1'
$env:TEST_DATABASE_URL = 'postgresql://root@127.0.0.1:26259/defaultdb?sslmode=disable'
go test -count=1 ./...
docker rm -f theme-api-db
```

Integration tests require CockroachDB, create a uniquely named database, apply the
real table migration, and drop that database afterward. The configured user needs
permission to create/drop databases. Without `TEST_DATABASE_URL`, only database
checks skip. Backend CI provisions CockroachDB and always enables those checks.

The backend embeds a deployment copy of `contracts/theme/portable.schema.json`
at `internal/themecontract/portable.schema.json`; a test requires byte equality.
When revising the shared schema, update that copy and run both contract suites.

To verify the existing extension against a running backend with curated sample
content at `http://localhost:8080`, run `npm run build` and then
`npm run test:legacy` in `apps/extension`. The smoke check runs the actual
extension in Chromium against a controlled local page and confirms that browse,
install, local storage and CSS application still use the legacy routes. It is
not a real Moodle or toolbar-popup check.
