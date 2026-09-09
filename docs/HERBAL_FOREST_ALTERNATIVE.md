# Forest immersion: approved default (B)

The user selected B on September 8, 2026. Forest immersion is now the default at `/herbs`, including plants, watches, and pantry. Existing `?design=forest` links still work; the earlier A study is available explicitly at `?design=classic` for historical comparison. The same composition and glass language now carries into fungi with a dark mycelial palette; see [MYCELIAL_DESIGN.md](MYCELIAL_DESIGN.md).

## Primary reference

[Forest UI design, posted by akgraphics](https://www.pinterest.com/pin/903605112758948160/). Inspected expanded in the user's Chrome tab. Its main characteristics are a dark emerald forest, a luminous opening, very large thin lowercase lettering near the lower left, quiet navigation, and a fine information line along the bottom.

The approved design follows that composition with an original forest background and an app-specific “gather.” headline. It retains the user's darker green spectrum, transparent glass direction, and reduced corner rounding.

## Supporting recommendations on the same page

- [Layered green palette](https://www.pinterest.com/pin/734227545535261826/): cooler near-black evergreen through muted mint.
- [Nature website layout](https://www.pinterest.com/pin/632896553915463304/): dominant nature photograph followed by a photo destination sequence.
- [Forest collage](https://www.pinterest.com/pin/1129066569108620304/): alternating wide landscapes, botanical details, and quiet text areas.
- [About Nature page](https://www.pinterest.com/pin/844284261434118253/): transparent layers over botanical imagery.
- [Calm of everything forest composition](https://www.pinterest.com/pin/718605684321250209/): restrained, widely spaced small text and breathing room.

These are visual interpretations of the recommendations visible during this review. Pinterest recommendations are personalized and can change. No Pinterest artwork is embedded in the app.

## Implementation

`HerbalApp.jsx` selects `ForestTodayView` by default. Only `design=classic` selects the historical A study. Navigation and browser history preserve that explicit comparison state. `herbal-forest.css` is scoped to `.herbal-shell--forest` and new `forest-*` elements.

- An edge-to-edge forest hero, light 300-weight display heading, and dark transparent header.
- A compact horizontal moon panel using the same phase-aware SVG and lunar calculation as the original study.
- Unboxed weather and secondary action bands; glass is concentrated around the moon and controls.
- Seasonal plants lead into watch-zone and pantry actions. The hero also links to the practical field-skills guide.
- Alternating 7/5 and 5/7 desktop atlas columns. One 330px-high photo per row on phones.
- Cooler tokens: canvas `#030b09`, deep `#06110e`, raised `#0b1b16`, accent `#c6ded1`, text `#f0f4ed`.
- Main surfaces have 8–10px radii. The compact moon has no arched top.

The account hooks, weather hooks, twelve botanical profiles, plant photos and credits, field notes, lunar information, watch-zone behavior, and pantry behavior are shared. The alternative changes presentation and sequence, not botanical information.

## Selection

The approved design gives imagery greater prominence and closely follows the primary reference. Its single-column mobile atlas involves more scrolling; the map stays immediately accessible through the collection switch. The prior comparison captures document A and B at the time of selection.

## Original backdrop

Asset: `frontend/public/images/herbs/forest-immersion.webp`, 1536 × 1024, 280,442 bytes. Generated with the built-in imagegen tool and encoded using cwebp at quality 84. Atmospheric decoration only; it is not used for plant identification. Generation source: `exec-5f699a8c-b496-49d5-af6d-4e0e58863988.png`.

### Final generation prompt

Use case: photorealistic-natural. Asset type: immersive full-bleed website hero background for a herbal gathering almanac. Primary request: an original deeply atmospheric ancient temperate forest, drawing on cinematic forest web design: monumental dark tree trunks framing a single soft vertical shaft of cool pale daylight through mist at the upper center-left, delicate ferns and moss below, tiny winding creek glint at bottom center-right, a sense of entering a quiet hidden clearing. Wide landscape 3:2 composition, rich spatial depth; foreground trunk sweeping up the right edge; background trees disappear into fog. Bottom left third remains very dark and simple enough for large ivory typography placed later in code, no text in the image. Lighting: dramatic contrast, luminous restrained silver-green opening above, near-black evergreen shadows; cool emerald / pine / teal green spectrum, minimal warm yellow. Natural botanical textures, elegant fine-grain landscape photograph, subtle mist, believable ecology, no oversaturated neon, no glowing magical objects, no mushrooms prominent, no people, no animals, no buildings, no UI, no text, no logos, no watermark. This is atmospheric decoration, not a plant identification image.

## Original design verification

The field-pause feature described in this historical verification was removed at the user’s request on 9 September 2026. The original backdrop remains selected.

Lint, production client build, SSR/prerender, and whitespace checks passed. Browser review used equal 1440 × 1000 desktop and 390 × 844 mobile viewports. Today, the atlas, and nettle field notes were captured for both versions. No horizontal overflow was found in the alternative's Today and atlas views. Search, empty results, plant detail opening/closing, the three-step field pause and restored focus, and guest watch/pantry navigation were exercised. The design parameter persisted through navigation.

The preview used a guest API fixture with no location selected. Authenticated writes and location-based weather were outside this visual comparison. Existing map chunk-size warnings remain unrelated to this study.
