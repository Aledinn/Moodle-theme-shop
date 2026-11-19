# Moodle Theme Archive design reference

This is the repository's reusable website design reference, taken from the
user-supplied website design kit. Start here when extending this website or
creating another website that should use the same visual language.

## Source of truth

- [Reference image](reference.png): the original supplied visual target.
- [Design specification](DESIGN_SPECIFICATION.md): the supplied layout, colors,
  type hierarchy, component measurements and responsive guidance.
- [Design tokens as JSON](design-tokens.json): portable values for reuse in
  another application.
- [CSS tokens](../../../apps/web/src/design-tokens.css): the values used by this
  application.
- [Design kit styles](../../../apps/web/src/styles.css) and
  [React integration styles](../../../apps/web/src/app.css): the implemented
  desktop/mobile layout and accessibility refinements.
- [Brand, icons, theme previews and fonts](../../../apps/web/public/design):
  locally served assets, provenance and font license notices.
- [Sample records](../../../apps/web/src/design-samples.json): the twelve
  illustrative themes from the kit.

## Reuse the design

1. Read the reference image and specification before changing the layout.
2. Reuse the tokens and locally hosted Anton / Barlow Condensed fonts. Retain
   the included SIL Open Font License notices when redistributing the fonts.
3. Preserve the rectangular geometry, cream paper, black dividers, red active
   states, cobalt actions, condensed type and compact catalog grid. Avoid
   rounded cards, floating shadows, gradients and generic marketing sections.
4. Use semantic HTML, visible keyboard focus and real UI controls. Build text
   and layout with components; do not use the reference screenshot as a page.
5. Compare desktop output at 1448px with the reference. Check the four/three/two/
   one-column transitions and keyboard access, including dialogs, down to 320px.
6. For a different website, adapt copy and data to that product while preserving
   the visual system. Do not copy sample institutions, authors, popularity
   figures or theme screenshots into real records.

## Current implementation and limits

Run the [web application](../../../apps/web/README.md), then open
`http://127.0.0.1:5173/?preview=design` to review the supplied sample collection.
The root URL uses the real Go API; sample records never enter the database and
never replace API failures. The design preview is explicitly labeled, and its
download actions explain that no real theme package is supplied.

The chosen implementation is a single-page catalog with guidance/metadata
dialogs. This follows the user's revised design direction; it does not fulfill
issue #3's original requirement for separate detail and installation routes.
The PR therefore references #3 without claiming to close it. Detail/download
behavior, extension import and deployment remain later work.

The original ZIP also contained a duplicate static starter and reconstruction
prompt. The retained reference, specification, portable tokens, working React
implementation and assets provide the reusable design without committing the
ZIP, local planning notes or scratch verification output.

The supplied image crops are prototype assets. See the recorded
[asset provenance](../../../apps/web/public/design/ASSET_PROVENANCE.md) before
reusing them in a public production site; original artwork and real theme files
were not included in the kit.
