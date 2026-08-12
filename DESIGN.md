---
name: Utah Forage Map
description: A calm, map-first field tool for Utah's mushroom community.
colors:
  field-pine: "#184A3B"
  field-pine-deep: "#123B2F"
  trail-blue: "#2563EB"
  safety-amber: "#B45309"
  danger-red: "#B42318"
  ink: "#17231F"
  ink-muted: "#52625A"
  canvas: "#F7F9F7"
  surface: "#FFFFFF"
  surface-muted: "#EDF2EF"
  border: "#CBD6D0"
typography:
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
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
    backgroundColor: "{colors.field-pine}"
    textColor: "{colors.surface}"
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

# Design System: Utah Forage Map

## 1. Overview

**Creative North Star: "The Field Desk"**

The interface should feel like opening a clean, well-organized field kit beside a map. Information is compact but never cramped, controls use familiar product patterns, and the public map stays visually dominant. A restrained palette and disciplined typography help source, review, and safety information carry more weight than decoration.

This system rejects account walls, generic SaaS landing-page composition, dense directory treatment, brown or beige outdoor palettes, novelty wilderness motifs, and tiny low-contrast controls. Responsive behavior is structural: side panels become drawers, toolbars simplify, and the map retains a useful viewport at every size.

**Key Characteristics:**

- Map-first and immediately useful to guests.
- Restrained color with high-contrast semantic states.
- Familiar controls with clear keyboard and touch behavior.
- Flat at rest, elevated only for temporary layers.
- Friendly field language grounded in evidence and safety.

## 2. Colors

The palette combines deep evergreen authority with cool neutral surfaces, clear trail blue for external data, and explicit amber and red safety states.

### Primary

- **Field Pine:** Primary actions, active filters, signed-in identity, and selected map state.
- **Field Pine Deep:** Hover and pressed states for primary actions.

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

**Display Font:** Inter (with system sans-serif fallback)
**Body Font:** Inter (with system sans-serif fallback)

**Character:** One humanist sans family keeps the tool readable and familiar. Weight and spacing establish hierarchy without introducing editorial display type into operational surfaces.

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
- **Primary:** Field Pine with white text and 10px by 16px padding.
- **Hover / Focus:** Deepen to Field Pine Deep; use a visible 2px focus ring with 2px offset.
- **Secondary / Ghost:** White or transparent with Ink text and a structural Border outline where needed.

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

- **Style:** White surface, Border stroke, 8px corners, and 44px minimum height.
- **Focus:** Field Pine border with a visible low-opacity ring.
- **Error / Disabled:** Danger Red text and border for errors; Muted Surface with readable Muted Ink for disabled state.

### Navigation

The top bar keeps the map and account routes visible. Active sections use Field Pine text and a quiet selected background. Mobile navigation collapses to icon-labeled commands and drawers while retaining 44px touch targets.

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
