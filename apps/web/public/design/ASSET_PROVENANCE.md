# Asset origin, limits and substitution plan

| Asset | Origin | Usable for final production? |
|---|---|---|
| `reference/selected-marketplace-reference.png` | Exact image uploaded by the user | Visual reference, not a working UI |
| `assets/themes/*.png` | Crops from the above raster image | Placeholder thumbnails. Low resolution; replace when real screenshots are available |
| `assets/hero/university-collage-reference-crop.png` | Cropped right-center hero region from raster image | Temporary illustration only; not an original/clean campus photograph |
| `assets/brand/logo-mark.svg` | New simplified geometric approximation of visible red m mark | Prototype only; check product naming and branding rights |
| `assets/icons/*.svg` | New basic vector line icons based on generic geometry | Suitable for prototyping |
| `data/themes.json` | Names/illustrative metadata visible in the AI-generated screenshot, manually transcribed | Demonstration only: not verified real authors, publishers, download counts or downloads |
| Fonts | External URL to Google Fonts, no font files included | Check font licenses/hosting options for production |

**Raster warning:** It is impossible to extract hidden original artwork, layered vector paths, or full-resolution images from a flattened PNG. Cards and university imagery are crops of already embedded pixels and could contain AI-generated details or visual inaccuracies. Use the reference to rebuild interface components, and substitute high-quality, licensed image assets.

## Local implementation font hosting

The React app downloads and hosts Anton and Barlow Condensed font files locally from Google Fonts. Their SIL Open Font License notices are included in fonts/Anton-OFL.txt and fonts/BarlowCondensed-OFL.txt. No external font request is required by the app.
