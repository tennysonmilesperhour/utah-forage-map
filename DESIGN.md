---
name: The Living Fungi Archive & The Verdant Hours
description: Two dark, immersive foraging collections joined by a shared visual language.
colors:
  fungi-canvas: "#0B090C"
  fungi-surface: "#181419"
  fungi-raised: "#282129"
  fungi-ivory: "#F1EAE1"
  fungi-muted: "#BFB4BA"
  fungi-plum: "#C4B5CE"
  fungi-bark: "#D6BFA9"
  herbs-canvas: "#030B09"
  herbs-surface: "#0B1B16"
  herbs-ivory: "#F0F4ED"
  herbs-sage: "#C6DED1"
  safety-amber: "#E0B765"
  danger-red: "#ED907E"
typography:
  family: "Avenir Next, Segoe UI, ui-sans-serif, system-ui, sans-serif"
  display-weight: 300
  body-weight: 400
  control-weight: 500
rounded:
  control: "8px"
  card: "8px"
  glass-panel: "10px"
---

# Shared design direction

The user selected **B: Forest immersion** on September 8, 2026, and requested the same theme for fungi with a dark mycelial palette. This supersedes the older museum/serif fungi direction and the original herbal study. The primary visual reference is [Forest UI design](https://www.pinterest.com/pin/903605112758948160/), with supporting pins documented in [the forest specification](docs/HERBAL_FOREST_ALTERNATIVE.md).

Both collections use cinematic nature imagery, very dark backgrounds and headers, thin sans-serif display type, quiet navigation, clear tinted glass with fine light edges, and restrained 8–10px corners. The collection switch keeps each world one click away. Herbs uses evergreen, sage, and cool ivory. Fungi uses near-black bark, charcoal, smoky plum, muted taupe, and warm ivory. An original photographic mycelial backdrop and a fine branching vector mark define the fungi identity.

## Composition and typography

- Immersive collection openings place a large 300-weight lowercase heading near the lower left, with concise field copy and a fine information line along the bottom.
- The fungi map remains the default fungi route, immediately usable by guests. It has a compact photographic filter-panel introduction, without a landing hero covering the globe.
- Community, species, and plant browsing carry the image-led treatment through to their content. Desktop collections alternate 7/5 and 5/7 photo cards; phones use one column.
- Product text remains readable and compact: 12–14px body copy, 10–12px controls, larger 30–38px editorial headings. Thin type belongs to display text; form labels and safety states retain stronger weights.
- Real, attributed species photography remains distinct from generated atmospheric artwork. Latin names may retain their established italic treatment.

## Glass, shape, and color

Use lightly reflective upper edges, dark transparent color gradients, and modest backdrop blur. Glass is concentrated on controls, navigation, and temporary layers. Text-heavy panels have enough dark tint to support reading. Avoid large opaque colored boxes or heavily frosted white surfaces. Buttons and repeated cards use 8px corners; glass panels and dialogs use 10px. Circular astronomical geometry stays circular.

Fungi tokens are scoped to `.mycelial-theme`; herbs uses `.herbal-shell--forest`. Legacy shared variable names are mapped inside the fungi scope so account forms, alerts, filters, region pages, species guides, and record detail share the same palette. Primary fungi actions are pale ivory over dark text; active glass controls use muted plum and ivory. Red and amber retain their safety meaning, and edible-listed states retain muted olive. Labels always accompany semantic color.

## Interaction and responsiveness

- Keep the public map and species archive available without authentication. Ask for an account only when saving, contributing, or opening private records.
- Keep keyboard focus visible and touch targets practical. Floating mobile navigation includes labels and device-safe-area clearance.
- Sidebars become drawers on phones. Overlays must preserve close controls, readable content, and scrolling at narrow sizes.
- Preserve all existing data, field-safety wording, credits, source links, privacy choices, and account workflows.
- Respect reduced-motion preferences. Do not animate full-screen artwork. Fungi glass has an opaque fallback for reduced-transparency preferences.
- Moon phase remains a calculated illustration with text for phase and illumination. Traditional correspondences must remain distinct from astronomical or scientific claims.

See [the fungi implementation and artwork provenance](docs/MYCELIAL_DESIGN.md), [approved herbal B](docs/HERBAL_FOREST_ALTERNATIVE.md), and [the earlier herbal reference history](docs/HERBAL_DESIGN.md).
