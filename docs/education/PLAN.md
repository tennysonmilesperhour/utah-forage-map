# Education / Guide Section — Plan

What we're building, why it will bring traffic, and how it fits the existing product. Companion
documents: [SPECIES_TEMPLATE.md](SPECIES_TEMPLATE.md) (page format and writing guidelines),
[SPECIES_CONTENT.md](SPECIES_CONTENT.md) (compiled research per species), and
[TRAFFIC_PLAYBOOK.md](TRAFFIC_PLAYBOOK.md) (SEO mechanics, channels, content calendar).

## 1. Goals

1. Bring organic traffic to the site year-round, not just during foraging season.
2. Make the site a genuinely useful identification-education resource — educational and
   insightful without becoming exhaustive or dull.
3. Reinforce the map: guides feed the map, the map feeds the guides. The live observation data
   is the moat — no static field guide and no AI answer has it.

### Approved implementation scope

The approved implementation now includes the guide itself: a `/learn` index, pages for a curated
30-species catalogue, safety and editorial-standard pages, live 90-day evidence, map links,
prerendered HTML, metadata, sitemap coverage, and an account-free poll for the next guide.

The comparison hubs, seasonal calendar, beginner course, yard guide, glossary, newsletter,
quiz, and printable cards discussed elsewhere in these research notes are not approved product
scope. They remain research only unless a later visitor need justifies them.

The strongest external validation: a mushroom education brand grew from 1,100 to 62,800 monthly
visitors in 7 months with exactly this model (templated, science-sourced species wiki), and two
small map-plus-guide sites (mushroomtracker.ca, fungiatlas.com) already rank with seasonal
calendars and poison guides. Details and sources in TRAFFIC_PLAYBOOK.md.

## 2. Information architecture

```
/learn                       Guide home: seasonal "fruiting now", beginner path, browse by group
/learn/species/<slug>        Species pages (the core; template in SPECIES_TEMPLATE.md)
/learn/compare/<a>-vs-<b>    Lookalike comparisons (morel vs false morel, etc.)
/learn/season                Data-driven seasonal calendar ("what's fruiting now near you")
/learn/start                 Beginner hub: the ~6 hard-to-mistake species + core skills
/learn/skills/spore-prints   Skill pages (spore prints, describing a find, photographing for ID)
/learn/groups/<group>        Major-groups orientation (boletes, amanitas, puffballs, LBMs)
/learn/yard                  "What's growing in my yard?" — year-round safety traffic
/learn/safety                Poison response, universal rules, myth debunks
/learn/glossary              Hover-definition glossary
/about + /disclaimer         Trust pages (who writes this, review process, liability stack)
```

Naming note: the existing `/field-guide` route is a how-the-map-works FAQ. Keep it (rename its
nav label to "How the map works" or fold it into `/learn`), and let `/learn` be the education
section. Exact route names are cosmetic; the structure above is the point.

## 3. How it fits the existing codebase

### Content storage: markdown in the repo, not the database

Species editorial content lives in git as markdown files with frontmatter (slug, latin name,
`inaturalist_taxon_id`, edibility axes, quick facts). Rationale:

- Versioned and PR-reviewable — which *is* the editorial review process the trust framework
  needs (reviewer sign-off happens in the PR).
- No migration churn while the template evolves.
- The `species` table stays the map's source of truth for filters and season signals; frontmatter
  links guide ↔ species by `inaturalist_taxon_id`, so a guide page can deep-link the filtered map
  and pull the species' live 90-day signal from `GET /api/species` + `GET /api/sightings`.

The existing `Species` columns (edibility, look_alikes, habitat_notes, peak_months,
elevation range, range_notes) remain the map's compact summary; the guide is where depth lives.
One schema addition worth making when implementation starts: a `slug` column so map popups can
link to `/learn/species/<slug>`.

### The SPA constraint (gates the whole traffic goal)

Guide pages must ship as real HTML: Googlebot renders JS unreliably at scale, and AI crawlers
(GPTBot, ClaudeBot, PerplexityBot) don't execute JavaScript at all — a client-rendered guide is
invisible to LLM citation traffic. The current client-side meta rewriting in
`frontend/src/lib/seo.js` is not enough for a content section.

Options, in order of preference:

1. **Build-time prerendering of `/learn/*` routes** (React Router v7 `prerender`,
   `vite-react-ssg`, or a small `react-dom/server` pass that walks the markdown content and
   emits HTML with correct meta + JSON-LD). Species pages change rarely; SSG at deploy is a
   perfect fit. Keep the map itself as an SPA — it doesn't need to rank.
2. A separate static-generation app (e.g. Astro) for `/learn`, same domain, shared design
   tokens. Clean, but a second build to maintain.
3. Full framework migration — not justified now.

Either of 1–2 also unlocks: per-page canonical/OG tags, `sitemap.xml`, and structured data
(`Article`, `ImageObject`, `BreadcrumbList`, `Dataset` — skip FAQ/HowTo markup; those rich
results are dead). Full checklist in TRAFFIC_PLAYBOOK.md.

### The internal linking loop

- Species page → "See recent observations" → map filtered to that species.
- Map sighting detail card → "Learn to identify this species" → guide page.
- Species pages cross-link their lookalikes (safety-relevant *and* crawl-friendly).
- Seasonal calendar and group pages act as hubs linking down to species pages.
- Community finds/events mention species → link them.

## 4. Trust and safety framework

This is YMYL (safety-critical) content; it's also where the community's trust battle is being
fought right now (AI-generated foraging books, ID apps tested at ≤49% accuracy). The framework:

1. **Named authorship + review.** Every species page carries an author, a "Reviewed by" line,
   and a "Last reviewed" date. Recruiting a local mycological society member as reviewer is
   achievable and worth it (NAMA lists 90+ clubs; this doubles as a partnership/link channel).
2. **The disclaimer stack** (standard across respected sites): the 100% rule on every species
   page; a multiple-sources requirement ("never eat anything based on this website"); an
   "educational reference, not a field guide" framing; a dedicated /disclaimer page with
   explicit liability language. The site's existing "a map observation is not an
   identification" stance extends naturally.
3. **Inline warnings at the point of danger** — inside lookalike cards and culinary sections,
   not only in banners.
4. **Two-axis badges** separating edibility from ID difficulty, icon + color + text (WCAG
   principle already in PRODUCT.md: never color alone).
5. **Route users to humans:** poison control (already present), mycological society finder,
   and honest "no algorithm can confirm edibility" messaging — which is also our
   differentiation against ID apps.

## 5. What makes this interesting rather than exhaustive

The user-stated worry is verbosity. The guardrails:

- The template's 30-seconds-scannable / 5-minutes-rewarding rule; ~500–900 words of prose per
  species with structure carrying the depth (badges, quick facts, cards).
- Lookalike cards and live data panels do the work paragraphs would otherwise do.
- One memorable fact per page (etymology, ecology, history) — personality is why the beloved
  sites are beloved; blandness is the actual failure mode, not length.
- Progressive disclosure: collapsibles for etymology/microscopy depth; group pages absorb
  material that would bloat species pages.

## 6. Roadmap

**Phase 1 — Foundation (make guide pages exist and rank):**
prerendering for `/learn/*`; the trust pages (/about, /disclaimer, how-we-verify); the species
page template component; first 12 species pages from the existing catalogue (content compiled in
SPECIES_CONTENT.md); `slug` column + map-popup links; sitemap + structured data. The catalogue was
then expanded to 30 species with a public request poll.

**Phase 2 — The traffic engines:**
seasonal calendar driven by live data; lookalike comparison pages (morel vs false morel first —
it's the biggest seasonal search event); beginner hub + spore print + yard pages; expand the
catalogue with the high-traffic and high-safety species recommended in SPECIES_CONTENT.md
(chicken of the woods, golden chanterelle, death cap, green-spored parasol, deadly Galerina…).

**Phase 3 — Retention and links:**
season-alert newsletter; ID quiz; printable field cards; mycological society outreach (embedded
club maps/event listings); annual "season recap" pages as evergreen link targets.

Phasing follows effort-vs-payoff rankings in TRAFFIC_PLAYBOOK.md §5. Each phase is
independently shippable; Phase 1 alone makes every future content addition indexable.

## 7. Measurement

Search Console from day one, guide pages tracked separately from the map; indexed-page count,
species-page CTR, image-search impressions, newsletter signups per seasonal push, inbound links
to calendar/progression pages. One session in Google Keyword Planner is worth doing to attach
real volume numbers to the species-page priority order (free-tool research couldn't verify
exact volumes).
