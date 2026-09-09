# Global herb gathering reference — first edition

Source-check date: **9 September 2026**. Independent botanical field review is **pending**.

## Scope and navigation

The guide starts a global botanical reference alongside the existing fungi guide. It contains 44 source-linked profiles, six regional collections, seven explicitly toxic reference plants, 73 licensed botanical photographs, six field-skills chapters, a glossary, and an editorial coverage page. It covers selected culinary plants, teas, cultivated herbs and traditional-use plants for study. It does not provide medicinal dosing or treatment recipes.

- `/herbs/atlas`: common/scientific-name and synonym search, accent normalization, region/habitat/use/reference-type/growth-stage facets, local saved plants and a two-plant comparison tray.
- `/herbs/atlas/:slug`: a shareable, printable profile with field marks, dangerous lookalikes, range, local-season context, preparation, stewardship, source links and photo credits.
- `/herbs/atlas/compare?plants=wild-garlic,lily-of-the-valley`: a shareable side-by-side reference. Empty columns remain in position. The interface never treats a comparison as a specimen identification.
- `/herbs/regions` and six region routes: climate distinctions, regional sources and filtered plant collections.
- `/herbs/fieldcraft`: whole-plant identification, seasons, collecting access and stewardship, food preparation/storage, food versus treatment, poison response, glossary and editorial scope.

All 54 new routes are prerendered. Plant content, cautions and citations remain present without JavaScript. Filters and saved plants require JavaScript; saved plants stay in the current browser. Print styles retain the profile, cautions and sources. This is not offline installation or cross-device syncing.

The Forest B Today screen and atlas retain the original forest-immersion artwork at the user’s request. The optional field-pause section and plant-reflection cards have been removed. The atlas and almanac now share `HerbalHeader.jsx`, including navigation, collection switch and account controls, so the menu stays in the same position between pages. The classic A view remains available. B’s former 12-entry atlas navigation opens the new reference; only the 12 existing almanac plants offer watch-zone and pantry links. The larger reference does not fabricate backend monitoring support.

## Evidence used

Taxonomy and morphology prioritize botanical gardens, floras, university extension and national botanical institutions. Preparation and safety use appropriate extension, public-health and poison sources. Profile-level citations state what each source supports. Summaries are original editorial synthesis, not institutional endorsements.

| Source family | Role and geographic limits |
| --- | --- |
| [NC State Extension Plant Toolbox](https://plants.ces.ncsu.edu/) | Morphology, parts, toxicity and growing conditions for temperate and cultivated plants; US horticultural context. |
| [Native Plant Trust Go Botany](https://gobotany.nativeplanttrust.org/) | Regional identification and distribution for wild mint, selfheal and true watercress; New England context. |
| [Kew Plants of the World Online](https://powo.science.kew.org/) and [MPNS](https://mpns.science.kew.org/mpns-portal/) | Scientific names, synonym resolution and range context. |
| [Singapore NParks](https://www.nparks.gov.sg/florafaunaweb) | Tropical and cultivated plant descriptions and specific food-preparation notes. |
| [SANBI PlantZAfrica](https://pza.sanbi.org/) and [Red List](https://redlist.sanbi.org/) | Cape shrubs, traditional-use context and harvest pressure. |
| [Australian National Botanic Gardens](https://www.anbg.gov.au/gnp/gnp14/backhousia-citriodora.html) and [Botanic Gardens of Sydney](https://www.botanicgardens.org.au/discover-and-learn/gardening-home/growing-native-gardens-and-bush-foods/tuck-bush-tucker-garden) | Lemon myrtle and Australian cultivated bush-food context. |
| [Woodland Trust](https://www.woodlandtrust.org.uk/visiting-woods/things-to-do/foraging/) and [BSBI](https://plantatlas2020.org/) | UK gathering guidance and Britain/Ireland botanical context. UK rules are not generalized worldwide. |
| [BfR](https://www.bfr.bund.de/en/press-release/wild-garlic-confusion-often-leads-to-poisoning/) and [UMN Extension](https://extension.umn.edu/natural-resources/forestry-and-wildlife/invasive-species/poison-hemlock) | Dangerous spring-leaf confusion and poison hemlock. |
| [NCCIH](https://www.nccih.nih.gov/health/chamomile), [CDC](https://www.cdc.gov/liver-flukes/about/index.html), [Poison Control](https://www.poison.org/first-aid-for-poisonings) | Herbal-product cautions, freshwater-plant parasites and exposure response. |
| [University of Georgia / NCHFP](https://nchfp.uga.edu/how/dry/recipes/herbs/) | Food-herb drying, storage and tested preservation guidance. |

The Brazil flora is linked as a regional directory; its protected content was not used as evidence. Community photographs support illustration and attribution, not medical claims or proof of field identity.

### Research corrections retained

- Roselle is indexed under Kew’s accepted **Sabdariffa gossypiifolia**, with **Hibiscus sabdariffa** retained as a familiar searchable synonym.
- Warrigal greens uses **Tetragonia tetragonoides**; **Tetragonia tetragonioides** is searchable because that spelling appears in a source.
- NC State’s requested `nasturtium-officinale` URL redirected to **Tropaeolum majus**, a different plant. That page and its photographs were rejected for watercress. Native Plant Trust’s true **Nasturtium officinale** account was used instead.
- A requested ragwort page redirected to a different Senecio species; no ragwort profile was added from that evidence.
- A conflicting flower-color phrase in a hemlock source was not copied; the profile uses independently supported white compound umbels.

## What “global” means in this edition

Regional labels are editorial starting points. They include native, introduced and cultivated plants and do not establish occurrence at a user’s location. Seasons describe growth stages and climate context rather than shifting a northern monthly calendar by six months. The old almanac’s broad temperate calendar is now labeled accordingly.

Forty-four plants cannot be a complete world inventory. Coverage is strongest for widely documented temperate herbs and a small group of tropical or cultivated plants. It is deliberately explicit about gaps. There is no authoritative edible/not-edible classifier, automatic plant identification, treatment recommendation, or assurance that all local lookalikes are included.

## Expansion and review plan

1. **Field review of this edition:** recruit qualified regional botanists and appropriate food-safety reviewers; check every character, synonym, poisonous lookalike, usable part and preparation note. Record reviewer, date, region and changes. Do not change the visible pending-review label before that work happens.
2. **Localize geography:** build country and ecoregion collections with current floras, access authorities and conservation sources. Separate native, introduced, naturalized and cultivated presence per region. Add verified local common names with language and location.
3. **Expand underrepresented floras:** prioritize regional specialists for South America, African regions beyond the Cape, South/Southeast Asia, Pacific islands and Aotearoa New Zealand. Identify locally important culinary plants and their local dangerous lookalikes together. Include Indigenous knowledge only where publicly shared with appropriate attribution and permission.
4. **Complete diagnostic imagery:** add whole plant, leaf front/back and attachment, stem, flowers, fruit and relevant seasonal stages, with scale. Use licensed real photographs whose exact species can be checked. Priority gaps include early spring wild-garlic lookalikes, pennyroyal, wet-ground plants and juvenile rosettes.
5. **Local seasonal evidence:** add dated observations and climate-aware phenology where a defensible data source exists. Keep observational occurrence separate from sustainable harvest availability.
6. **Broaden emergency guidance:** add verified country-specific poison services and emergency numbers, with jurisdiction, operating hours and review dates. The current US number is clearly labeled; other regions are directed to their local service.
7. **Field usability:** add downloadable offline packs, location-specific saved collections and reviewed translations after the taxonomy and safety model is stable. The current print field sheet is the portable first step.

A mature species record should have: a resolved taxon identifier and synonyms; local names with language; separate geographic presence states; a referenced key for relevant growth stages; a checked dangerous-lookalike set; parts and preparation constraints; personal safety notes; conservation/access evidence; sufficient licensed diagnostic photos; source dates; reviewer identity and a correction history. “Complete” must be assessed against an explicit regional coverage list, not the number of cards on a page.

## Adding or correcting a profile

The content lives in `frontend/src/data/herb-guide.json`. Rendering/search/regions live in `herbGuide.js`; general chapters in `herbFieldcraft.js`. Keep slugs stable for shared URLs. Add aliases without silently replacing a plant with a related species. Preserve the current schema and ensure all facets and lookalike slugs resolve. Toxic profiles must have no gathered parts, use only the toxic reference facet, and show the all-stages hazard.

For every assertion, retain a specific source and the aspect it supports. Record source-check and specialist-review status separately. Never derive preparation from a common name or related species. Preserve original photo URLs, creator, exact license/source links, captions and modifications. See `HERBAL_PHOTO_CREDITS.md` for the complete asset register.

Corrections: **morphiclabsdata@gmail.com**. Include the affected plant page, proposed correction and supporting botanical or safety source; omit sensitive wild locations.

## Validation

From `frontend`: `npm run lint`, `npm run build`, then `npm run test:herbs`. Tests cover synonyms, intersecting filters, saved-only empty results, toxic-label invariants, source/asset/route integrity, regional links, all 44 prerendered profiles and 54 sitemap routes, and empty/duplicate comparison selections. Browser checks cover desktop and 390px mobile layouts, search, saved plants, comparison hydration, navigation and overflow. These tests verify software and content structure; they are not botanical field validation.
