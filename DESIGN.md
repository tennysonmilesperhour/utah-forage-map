---
name: Mushroom Forage Map
description: A living field atlas for exploring recent mushroom evidence worldwide.
colors:
  field-pine: "#83A978"
  field-pine-deep: "#5C8058"
  spore-coral: "#D66B50"
  trail-blue: "#66A8B3"
  safety-amber: "#D8A746"
  danger-red: "#B7433A"
  ink: "#F0F2E9"
  ink-muted: "#A9B6AF"
  canvas: "#101816"
  surface: "#18211E"
  surface-muted: "#25312D"
  border: "#53625B"
typography:
  headline:
    fontFamily: "Libre Baskerville, Baskerville, Georgia, serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "Libre Baskerville, Baskerville, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Avenir Next, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Avenir Next, Segoe UI, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "0"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.spore-coral}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: Mushroom Forage Map

## 1. Overview

**Creative North Star: "The Living Field Atlas"**

The interface combines a field instrument, a specimen archive, and a quiet museum after dark. The globe is the primary experience. Observation photography links the map, community record, regional collections, and species guide into one continuous journey. Information remains compact and familiar while editorial scale, image-led collection layouts, and restrained motion give the product a distinct cultural identity.

This system rejects account walls, generic SaaS landing-page composition, dense directory treatment, brown or beige outdoor palettes, novelty wilderness motifs, and tiny low-contrast controls. Responsive behavior is structural: side panels become drawers, toolbars simplify, and the map retains a useful viewport at every size.

**Key Characteristics:**

- Map-first and immediately useful to guests.
- A varied biological palette with high-contrast semantic states.
- Familiar controls with clear keyboard and touch behavior.
- Flat at rest, elevated only for temporary layers.
- Friendly field language grounded in evidence and safety.
- Asymmetric collection layouts that make imagery and metadata equally useful.

## 2. Colors

The palette begins with green-black gallery surfaces, then uses lichen green for growth, spore coral for active exploration, mineral blue for sourced evidence, and explicit amber and red safety states. Color is never the only carrier of meaning.

### Primary

- **Spore Coral:** Primary exploration actions, active navigation, and current map signal.
- **Field Pine:** Growth, edible-listed state, selected lenses, and positive review state.

### Secondary

- **Trail Blue:** Imported observations, links, and informational state.

### Tertiary

- **Safety Amber:** Caution and field-safety messages.
- **Danger Red:** Destructive actions, authentication errors, and poisonous or deadly status.

### Neutral

- **Ink:** Primary copy and high-priority data.
- **Muted Ink:** Secondary copy that still meets AA contrast.
- **Canvas:** App background outside the map.
- **Surface:** Panels, menus, and forms.
- **Muted Surface:** Selected rows, quiet controls, and grouped regions.
- **Border:** Structural dividers and input boundaries.

### Named Rules

**The Map Signal Rule.** Accent colors identify actions or data states; they are never scattered as decoration.

## 3. Typography

**Editorial Font:** Libre Baskerville (with Baskerville and Georgia fallbacks)
**Product Font:** Avenir Next (with Segoe UI and system sans-serif fallbacks)

**Character:** The serif belongs to collection titles, species names, and interpretive headings. Product controls, data, labels, forms, and navigation remain in the humanist sans family for speed and outdoor legibility.

### Hierarchy

- **Headline** (700, 24px, 1.2): Major panel and dialog titles only.
- **Title** (650, 16px, 1.35): Section titles, selected finds, and account identity.
- **Body** (400, 14px, 1.5): Descriptions and field notes, capped at 70 characters where prose runs long.
- **Label** (650, 12px, 1.35): Form labels and compact metadata; sentence case by default.

### Named Rules

**The Outdoor Readability Rule.** Secondary text remains readable in bright light; pale gray body copy is prohibited.

## 4. Elevation

The system is flat by default. Borders and tonal layers organize persistent panels. Compact shadows appear only on menus, dialogs, drawers, popovers, and map overlays that physically sit above the task.

### Shadow Vocabulary

- **Floating control** (`0 2px 8px rgba(23, 35, 31, 0.16)`): Map controls and menus.
- **Modal layer** (`0 12px 32px rgba(23, 35, 31, 0.22)`): Authentication and confirmation dialogs without a simultaneous decorative border.

### Named Rules

**The Flat-at-Rest Rule.** Persistent panels do not float; elevation communicates temporary layering or active interaction.

## 5. Components

### Buttons

- **Shape:** Compact, gently curved corners (8px).
- **Primary:** Spore Coral with Ink text and 10px by 16px padding.
- **Hover / Focus:** Deepen the coral tone; use a visible mineral-blue focus ring with 2px offset.
- **Secondary / Ghost:** Surface or transparent with Ink text and a structural Border outline where needed.

### Chips

- **Style:** Muted Surface with Ink text and a full pill shape for compact state only.
- **State:** Selected chips use Field Pine and white text; source and safety chips pair color with text or an icon.

### Cards / Containers

- **Corner Style:** 8px for repeated items and 12px for dialogs.
- **Background:** Surface or Muted Surface based on hierarchy.
- **Shadow Strategy:** Flat persistent surfaces; compact shadows only for floating layers.
- **Border:** One structural Border stroke where separation requires it.
- **Internal Padding:** 12px for dense items, 16px for panels, 24px for dialogs.

### Inputs / Fields

- **Style:** Museum Black surface, Border stroke, 4px corners, and 44px minimum height.
- **Focus:** Mineral Blue border with a visible low-opacity ring.
- **Error / Disabled:** Danger Red text and border for errors; Muted Surface with readable Muted Ink for disabled state.

### Navigation

The top bar keeps the map and account routes visible. Active sections use a Spore Coral underline and clear Ink text. Mobile navigation collapses to icon-labeled commands and drawers while retaining 44px touch targets.

### Guest Access Prompt

A compact, dismissible map overlay states that the full public map is available without an account. Account creation is offered as the path to saving and contributing, never as a prerequisite for browsing.

## 6. Do's and Don'ts

### Do:

- **Do** keep the public map interactive before authentication.
- **Do** ask for an account at the moment a user saves, submits, or opens a private logbook.
- **Do** pair every status color with text or an icon.
- **Do** maintain 44px touch targets and WCAG AA contrast.
- **Do** use source, review, privacy, and safety language near the relevant action.

### Don't:

- **Don't** use account walls that block the public map before users understand its value.
- **Don't** use generic SaaS landing pages, oversized marketing headlines, or decorative feature-card grids.
- **Don't** use dense directory pages that make every link compete at the same visual weight.
- **Don't** use brown or beige outdoor palettes, novelty wilderness motifs, or decorative map styling that obscures data.
- **Don't** use tiny, low-contrast controls that fail in bright outdoor light.
- **Don't** pair a decorative wide shadow with a bordered card.
