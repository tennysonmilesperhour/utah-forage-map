# Mycelial forest: fungi adaptation of B

Approved direction: the same Forest immersion theme selected for Herbs, with a dark mycelial identity. Implementation: `frontend/src/mycelial.css`, scoped to `.mycelial-theme` on both the map app and server-rendered guide shell. Shared header marks use `MyceliumMark.jsx`.

## Palette and surfaces

Canvas `#0b090c`, surface `#181419`, raised plum `#282129`, ivory text `#f1eae1`, muted text `#bfb4ba`, pale plum `#c4b5ce`, bark accent `#d6bfa9`. Primary buttons use ivory with dark text. Clear glass has a lightly reflective edge and 14–20px blur. Cards and buttons have 8px corners; panels and navigation 10px. Safety colors retain separate red, amber, and muted olive states.

The public map remains the fungi entry. Filters, search, map overlays, records, community, authentication, account panels, watch forms, guide pages, regions, and informational pages inherit the shared theme. The globe atmosphere and cluster colors use charcoal/plum; individual species markers retain their existing semantic colors. No map data, coordinates, or scientific content changed.

The species archive and community opening use cinematic imagery and thin lowercase headings. Species cards remain linked to their real, attributed photography and field notes. Mobile navigation has four labeled destinations and safe-area clearance. The herb default changed to B; the earlier comparison remains reachable with `?design=classic`.

## Current backdrop

The approved replacement is `frontend/public/images/fungi/forest-floor-extended.webp` (1672 × 941, 142,682 bytes). It is the previously generated photographic extension, used unchanged. The original source is [Matt Richmond’s photograph](https://unsplash.com/photos/mushrooms-grow-on-a-dark-weathered-log-dcnWLYD4IFA), published 12 March 2025, with Sony ILCE-7M4 camera metadata and the [Unsplash License](https://unsplash.com/license).

The real photograph was extended with AI to continue the weathered log and forest floor across the left side. It is decorative artwork, not unaltered documentary or identification evidence. A visible source credit and extension disclosure accompany the archive hero. It replaces the former generated backdrop in the archive hero, map filter heading, community hero and authentication context. Species reference photographs remain unchanged.

The archive overlay is lighter so bark and leaf-litter detail remain visible across the left. Narrow crops favor the mushroom subjects on the right. A new filename prevents a cached old scene from persisting after deployment. The previous generated asset has been removed from the current public assets; its provenance follows for history.

## Previous artwork (retired)

Mode: new generation with the built-in imagegen tool, no reference-image edit. Asset: `frontend/public/images/fungi/mycelial-forest.webp`, 1536 × 1024, 184,324 bytes; encoded with cwebp quality 84. Source: `exec-c40aa7a9-82a0-4b07-a644-231e5a019ddc.png`. Generated atmosphere is decorative, never a scientific illustration or an identification photograph. Its empty alt text avoids implying a species identification. All existing species-photo attribution remains in the guide detail pages.

### Final generation prompt

Use case: photorealistic-natural. Asset type: wide atmospheric hero backdrop for a dark fungi field atlas, visually related to a dramatic forest website. Create an original cinematic forest-floor scene at twilight: ancient dark decaying wood crossing the right half, very fine ivory mycelial threads spreading organically across its bark and humus, several small delicate mushroom caps and visible pale gills clustered in the lower right, ground-level depth disappearing into a tall shadowy forest and restrained silver mist at upper center. The mycelial branching must be subtle, irregular and natural, not a glowing neural network. A mysterious but believable macro-to-landscape photographic composition. Rich near-black bark, charcoal umber, dusty muted aubergine shadows, soft taupe caps, pale pearl/ivory threads; muted hints of copper, very little green. Deep black negative space across left third and lower left for large thin ivory typography to be added later in code. Restrained pale side lighting skims gills and filaments, single misty opening high in background, no neon or artificial glow. Wide landscape 3:2. Real fine textures, elegant premium editorial nature photograph, no people, no text, no labels, no logo, no UI, no watermark. Atmospheric decoration only, not scientific identification or a species illustration.

## Verification

Frontend lint and the production client/SSR build passed, including prerendering 46 guide routes and 3 app routes. Existing map bundle-size warnings remain. Desktop and mobile browser verification and captures are recorded in the PR. No authenticated write was needed for this visual change.

