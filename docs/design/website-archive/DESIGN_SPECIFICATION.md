# Design specification — Moodle Theme Archive

## Visual personality

**Concept:** Swiss graphic-design poster meets academic magazine index. Brutalist editorial UI, intentional density, black graphic rules, a tiny hint of print texture, fast scannability. It should look created by a designer with taste, not an auto-generated SaaS marketing template.

**Avoid:** rounded corners, large drop shadows, glassmorphism, gradients in the interface, oversized empty cards, pastel purple, excessively large icons, pills, floating filter drawers on desktop, generic 'hero + feature cards' bloat.

**Keep:** brutal rectangular geometry, red/blue/black/off-white, loud display hierarchy in a deliberately compact cover banner, strict 4-column theme listing, denser filtering sidebar, understated metadata.

## Palette (sampled/approximated, not source CSS)

| Token | Hex | Usage |
|---|---|---|
| `--paper` | `#F8F2E8` | Warm cream background |
| `--paper-warm` | `#F8F0E2` | Slightly warmer alternate backdrop |
| `--ink` | `#101014` | Text, lines, black section headers |
| `--red` | `#DF231F` | Brand accent, diagonal slash, active nav, active pagination |
| `--red-hover` | `#BE1E1A` | Hover/active red |
| `--blue` | `#0639B5` | Download buttons, featured tag, links |
| `--blue-hover` | `#002B8F` | Download hover |
| `--rule` | `#15151A` | Borders/dividers |
| `--muted` | `#4D4B4A` | Secondary information |

Because the source has raster noise and image-generation texture, there is no single exact RGB value for each color block. Chosen values are representative from screenshot color clusters and adjusted for readability.

## Type system

| Role | Suggested font | Weight | Size (desktop) |
|---|---|---|---|
| Primary cover headline | Anton | 400 | 70–77px, line-height ~0.94 |
| Brand mark word title | Anton | 400 | 24px |
| Card title | Anton | 400 | 22–26px |
| Sidebar section headings | Barlow Condensed | 900 | 21px |
| Nav links | Barlow Condensed | 800 | 17px, 1–2px tracking |
| Body & metadata | Barlow Condensed | 600–700 | 14–16px |
| Buttons | Barlow Condensed | 900 | 13–15px |
| Hero strapline | Barlow Condensed | 800 | 14px, 3px tracking |

**Exact match limitation:** A PNG cannot identify the authoring font. Anton and Barlow Condensed were selected as open-web, close visual substitutes. The reference may use other condensed display faces. If necessary, compare Anton, Bebas Neue, Oswald and Archivo Narrow visually.

Google Fonts URL: https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@400;500;600;700;800;900&display=swap

## Layout anatomy at the source's 1448 × 1086 resolution

- **Top navigation:** approx. y=0–75 px; left brand cluster, compact navigation toward the right; 2px black bottom rule.
- **Cover banner:** approx. y=76–290 px, h=215px. Left oversized text sits around x=38px. Red diagonal slice around center-left; university architecture and cobalt background on right. Small white category labels at far right.
- **Catalog shell:** begins y~292px.
- **Desktop filter rail:** x=0–295px, width approx. 296px including separator; dense form controls, black section heading.
- **Results toolbar:** y~293–366px; results count at x~319px, search field across center, view toggle at right.
- **Card grid:** 4 columns to the right of sidebar. Cards are dense, generally 240–275px across, with 9–12px internal padding and 1–2px dark grid rules. 12 cards shown in mockup, in three rows.
- **Thumbnail previews:** roughly 2.3–3.1:1 wide crops; show a Moodle page UI fragment. Dynamic image aspect ratio can be standardized around 2.4:1, but preserve the horizontal composition.
- **Pagination:** compact numbered rectangular controls below catalog, aligned with a 'showing N–M of X' label.
- **Sidebar:** manual checkboxes and search, around 15–19px body text. Avoid oversized default form controls.

## UI behavior

- Site-wide global search matches theme title, author, and university. Left search filters theme title only.
- Dropdown sort offers downloads descending/ascending, alphabetical name ascending/descending.
- University dropdown + optional quick university checkboxes; no filter ambiguity (selecting one should clear the other, as in the starter).
- Popularity ranges are multiselect OR rules, then combined with all other filters using AND.
- Cards display screenshot, name, author, institution, downloads, CTA; optional Featured badge.
- Grid/list toggle preserves current filtering and sort.
- Pagination resets on query/filter change. Provide 12/24/48 page size options.
- A download CTA should not be active as a real file download until a real theme file URL exists. In demo, it displays an explanation.

## Responsive plan

- **≥1320px:** four-column compact grid, 296px sidebar, full desktop masthead.
- **1081–1319px:** four columns if space allows; compressed masthead and metadata. Reference starter switches to three at 1080px.
- **781–1080px:** three columns, 258px sidebar; hide descriptor if space is constrained.
- **511–780px:** sidebar reflows above catalog as two-column filter sections; two-column cards.
- **≤510px:** one-column cards and one-column filters; horizontal nav can scroll; maintain semantic hierarchy.

## Sample content shown in reference

The exact reference screenshot shows: Campus Modern, Aurora, Nightfall, GreenCampus, Minimal Lite, Ocean Breeze, Academic Pro, NeoLearn, EduFlex, Classic Moodle+, Slate, BrightLearn. It visually says **86 themes** while showing 12 on the page. The starter ships only these 12 *illustrative* records, so its count correctly says **12**. Change to your real catalog count when actual records exist.

## Production requirements / backend handoff

Recommended theme record fields: `id`, `name`, `slug`, `author`, `university` (can be null), `description`, `preview_image`, `screenshots[]`, `download_url`, `downloads`, `created_at`, `updated_at`, `compatible_moodle_versions[]`, `compatible_extension_versions[]`, `license`, `file_hash`, `approved`, `tags[]`. Keep a separate publisher/profile record if authors can submit themes. Verify the extension format, security screening, content moderation, preview rights, download integrity, and rate-limiting. Avoid treating institution names shown in demo as university approval.
