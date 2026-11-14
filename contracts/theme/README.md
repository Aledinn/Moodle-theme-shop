# Portable theme contract — revision 1

This directory is the version-controlled interchange contract for website downloads
and extension imports. `portable.schema.json` (JSON Schema draft 7), the transport
rules below, and `fixtures/manifest.json` are normative together. The schema alone
cannot enforce file size, duplicate JSON keys, or browser CSS parsing.

This ticket defines the contract and supplies independent contract checks; existing
HTTP handlers and extension installation paths are not yet wired to those checks.
Accounts, publication state, moderation, API routing, and UI are separate work.

## Portable object

All six existing fields are required. There are **no optional fields** in revision
1. Unknown fields are rejected at every object level; never strip them and continue.
Nulls, numbers in string fields, defaults, and type coercion are not accepted.

| Field | Type | Limit / meaning |
| --- | --- | --- |
| `name` | string | 1–120 Unicode code points; not whitespace-only |
| `site` | string | 1–253 ASCII characters; canonical hostname below |
| `author` | string | 1–80 Unicode code points; not whitespace-only; unverified display text |
| `description` | string | 0–2,000 Unicode code points |
| `version` | string | 1–32 Unicode code points; not whitespace-only; author's release label, not necessarily semver |
| `rules` | array | 0–500 rule objects, kept in their original order |

Metadata is plain text. Reject C0/C1 controls, `<`, `>`, bidi overrides U+202A–U+202E,
and bidi isolates U+2066–U+2069. Do not trim or sanitize values on import. Render even
accepted metadata as text, never HTML; validation does not replace output escaping.
Repeated selectors are allowed; consumers must preserve rule order and CSS cascade.

Portable objects exclude `id`, database keys, account/session fields, tokens,
publication flags, and any API envelope. An API download must explicitly project
the six fields, rather than serialize a database/API record into the file.

## Hostname normalization and support

Producers derive `site` from a parsed HTTP(S) URL's **hostname**, lowercase it,
remove one terminal DNS root dot, and use ASCII IDNA/punycode for internationalized
names. Portable validators require this canonical spelling and reject noncanonical
input; they do not normalize an imported file or change its target site.

Revision 1 supports dotted ASCII DNS hostnames with 1–63 character labels and a
letter-led final label, or canonical dotted-decimal IPv4 (four octets 0–255, no
leading zeros). Labels use lowercase letters, digits and interior hyphens. The
253-character overall limit excludes any root dot. Punycode labels are accepted.

URLs, credentials, ports, paths, wildcards, whitespace, Unicode hostnames, IPv6,
single-label names (including `localhost`), empty labels and trailing dots are
unsupported. IPv4 loopback remains supported to preserve the existing editor
export captured on the controlled local Moodle-like page. A syntactically supported
hostname is not proof that the site is Moodle or that the extension has permission
to apply styles there. No domain allowlist is introduced by this contract.

## Rules and CSS subset

A rule has exactly `selector` (string) and `properties` (object). Empty properties
and an empty rules array are valid: selecting an element before choosing a property
creates an empty rule in the current editor.

Selectors are 1–512 ASCII characters. The schema defines the complete grammar:
tag names, class names and IDs can form compounds, separated by a single ASCII
space for descendants. Tags begin with a letter and continue with letters, digits
or hyphens. Class/ID identifiers begin with a letter or underscore, or a hyphen
followed by a letter, underscore or hyphen, then use letters, digits, underscores
or hyphens. Examples: `h1.course-title`, `.course`, `#page`, `div div p`.

Reject selector lists, universal/attribute/pseudo selectors, combinators other than
descendant spaces, namespaces, escapes, comments, at-rules, nesting and CSS blocks.
Browser consumers must also parse **every** structurally accepted selector using
`document.querySelector` (or an equivalent browser parser), catch syntax errors,
and reject the entire file before storage/application. Matching an element is not
required. The TypeScript validator accepts a browser document for this additional
check; callers outside a DOM must arrange a document/offscreen/content context.

Only these property names are allowed, case-sensitively (at most 3 per rule;
property names are bounded to 32 characters by the allowlist):

| Property | Accepted values |
| --- | --- |
| `background-color`, `color` | `#RGB` or `#RRGGBB`, case-insensitive hex digits |
| `font-family` | Exactly `Arial, sans-serif`, `Verdana, sans-serif`, `Georgia, serif`, `'Courier New', monospace`, or `system-ui, sans-serif` |

All values are strings, at most 128 characters, with no surrounding whitespace.
The font stacks are exactly the current editor choices. Browsers must additionally
check `CSS.supports(property, value)` before application. Do not serialize CSS back
into the imported values: browser normalization must not change portable data.

This allowlist excludes URLs (including `data:`, `blob:` and protocol-relative
URLs), resource loads, `@import`, `@font-face`, custom properties, `var`, `attr`,
`calc`, `expression`, named/functional colors, escapes, declaration separators,
comments and `!important`. The existing application layer may add its own
`!important`; it is not part of a portable value. Only locally available fonts
may be selected, never downloaded through theme CSS.

## Transport and rejection

Files contain exactly one UTF-8 JSON value without a BOM, at most **262,144 bytes
(256 KiB)** including whitespace. Reject invalid UTF-8, malformed/trailing JSON,
duplicate keys at any depth, and nesting deeper than 32. Reject isolated JSON
surrogate escapes rather than replacing them with U+FFFD. Enforce the byte limit
while reading a stream, before parsing or accumulating an unbounded request.
The supplied validators take already bounded byte arrays; HTTP/file adapters
must implement bounded reads. The byte limit and 500-rule limit both apply;
500 maximum-size selectors may exceed the byte limit.

Validate the complete candidate before producing any side effect. Any invalid
field/rule rejects the entire file. Do not truncate, drop rules, default metadata,
strip unknown fields, replace the site, or reinterpret unsupported CSS. Report an
error; leave installed themes untouched. No partial import is part of this format.

## API metadata and opaque IDs

`api-summary.schema.json` defines metadata records: the five metadata fields above,
plus required `id`, with no rules. `id` is an opaque, nonempty string bounded to
128 code points. Never parse it as an integer, sort numerically, increment it or
convert it through JavaScript `Number`. The API fixture `"9007199254740993"` exceeds
JavaScript's safe integer range. Another fixture uses a nonnumeric ID. A detail
response may combine summary fields with portable `rules`; it is still an API
record and must be projected into a portable file. API envelopes/pagination are
outside this ticket. Existing Go `ThemeSummary.Id` already uses a string.

## Compatibility and evolution

The author's `version` remains untouched. Contract revision 1 is tracked by these
schema documents and fixture manifest, **not** a required field in exported JSON.
No `schemaVersion` field is added: existing strict consumers would reject it.

`fixtures/valid/editor-export.json` is the unmodified saved editor download from
the earlier local lifecycle check, including its `127.0.0.1` target. The bundled
example and all five editor font choices are also preserved as accepted fixtures.

Compatibility adjustment: the old API accepts incomplete metadata and defaults
an empty version, and the editor can generate escaped selectors for unusual class
names or more than 500 rules. Those permissive behaviors are not a safe interchange
contract. Such files now fail contract checks explicitly; they are not silently
fixed. Current normal editor exports with all six fields and the documented subset
need no migration. Broader CSS (including arbitrary colors/fonts), escaped class
names, IPv6, and larger files require an explicit reviewed contract revision and
new shared fixtures. No increase to the initial byte/rule limits was needed to
preserve the recorded export. Check limits on real exports before revising them.

Future compatible changes must retain existing valid fixtures. Changes that add
fields or extend the accepted language require coordinated consumer support and
explicit negotiation through a future media type/API or import migration path;
do not repurpose `version` or send new fields to strict old consumers. Breaking
changes need a separately versioned schema and an explicit, user-visible migration
policy. Invalid/unsupported files remain failures until that revision is adopted.

## Running the shared checks

From the repository root:

```powershell
cd apps/backend
go test -count=1 ./...
cd ../extension
npm ci
npx playwright install chromium
npm test
npm run typecheck
npm run build
```

Both suites enumerate the same manifest and fail for unlisted fixtures. Go checks
use `-count=1` because shared files live outside the Go module and changes to them
may not invalidate Go's test cache. The Go suite checks
the schema/transport rules and round-trips the large ID through the actual API
metadata model. TypeScript runs the schema/transport checks in Chromium, exercises
real selector/value parsing, checks rejection from a browser parser, and asserts
that successful validation preserves every value. Both check input byte retention.
Fixtures include maximum metadata/selector/rule bounds, malformed/oversized files,
hostile metadata, unsupported sites/CSS, unknown fields and unsafe numeric IDs.
