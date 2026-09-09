# The Verdant Hours: visual direction

The user designated [this App Design board](https://www.pinterest.com/thekiwipop/app-design/) as the visual reference for the herbal collection on September 8, 2026. It supersedes the previous celadon-paper and plum direction for Herbs. The 15-pin board was inspected in Chrome, including its forest, botanical, frosted-glass, and mobile-interface references.

## References and their application

- [Forest UI design](https://www.pinterest.com/pin/903605112758948160/): immersive woodland photography, light through trees, restrained navigation, generous space for the title.
- [Forest weather interface](https://www.pinterest.com/pin/903605112758944662/): a rounded, arched glass instrument over forest imagery; used for the sky clock.
- [Botanical typography](https://www.pinterest.com/pin/903605112758948157/): quiet sans-serif type, foliage depth, transparent green surfaces.
- [Frosted glass](https://www.pinterest.com/pin/903605112758939310/): translucent panels with soft blur, fine luminous edges, readable text.
- [Leafora plant app](https://www.pinterest.com/pin/903605112758939212/): image-led plant browsing, sage actions, compact rounded controls, floating mobile navigation.
- [Botanical mobile screens](https://www.pinterest.com/pin/903605112758939314/): plants as the primary visual subject and restrained supporting information.

## System

The user refined this direction on September 8, 2026: darker background and header greens, clearer transparent iOS-like glass, and approximately half the corner rounding on boxes and buttons.

- Canvas: near-black forest `#050d09`; elevated surface `#101e16`; deep surface `#09130e`; header `rgb(2 9 5 / 94%)`. Keep the light sage and ivory end of the palette for stronger contrast.
- Text: ivory `#f2f5e9`; secondary sage `#bbcbbd`; primary action `#d3e7aa` with dark text `#172c1d`.
- Avenir Next, Avenir, Segoe UI, then sans-serif. Light-to-regular display headings; compact, readable controls.
- Glass panels use a clear, lightly tinted gradient (12–48% opacity), 12px backdrop blur with 135% saturation, and fine specular edge highlights. Regular boxes use 11–14px corners and buttons use 14px corners, approximately half the initial rounding. The desktop sky-clock arch is 75px; circular moon and botanical marks stay circular. Text-heavy plant notes use a dark, near-opaque surface.
- The moon uses a softly textured silver disc, muted earthshine, a faint halo, and one fine orbital accent. Its illuminated area follows the calculated illumination and waxing/waning direction. This is a north-up phase illustration, not the observer-specific apparent tilt. Keep the graphic still and decorative; the adjacent phase and illumination text provide its accessible meaning.
- Today combines forest artwork, introductory copy, live calculated sky information, and opt-in weather. The reflection practice and seasonal plant gallery follow below.
- The atlas uses real, attributed plant photography with transparent, dark glass captions. Generated atmosphere must never replace identification photography.
- At 980px and below the four primary destinations form a floating bottom navigation bar. Content and footer provide clearance for the bar and device safe areas.
- Active states use shape and text in addition to color. Controls retain visible keyboard focus. Honor reduced-motion preferences. Do not animate the full-screen forest or introduce auto-playing media.
- Keep astronomical data, broad seasonal guidance, and cultural traditions clearly distinguished. Preserve field safety, privacy, source attribution, and the three-step reflection flow.

`frontend/src/herbal.css` loads with the herbal app, extends the existing shared structural styles, and owns the new collection-specific visual rules. Fungal styling and data behavior are unchanged.

## Forest artwork

Asset: `frontend/public/images/herbs/forest-sanctuary.webp` (1536 × 1024, approximately 383 KiB). Generated with the built-in imagegen tool, then encoded to WebP. It is decorative atmosphere, with empty alt text. No Pinterest pin artwork is bundled into the app.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: full-bleed atmospheric background for an herbal gathering app. Create an original cinematic photograph of an intimate lush temperate woodland at early morning: tall fern fronds, moss-covered rocks, rich layers of small green leaves, old tree trunks fading into soft silver-green mist, subtle shafts of warm morning light entering from upper right. Forest emerald, olive and muted sage, deep shadow at left and bottom to support white interface text. A softly glowing clearing slightly right of center, lush detailed fern foreground along lower right. Wide landscape 3:2 composition, realistic botanical textures, quiet immersive sanctuary atmosphere, natural editorial photography, no oversaturated neon. No people, no buildings, no pots, no mushrooms, no text, no logos, no interface, no graphic overlays. This is atmospheric artwork only, not a plant-identification image.
