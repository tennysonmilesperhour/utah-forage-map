# Traffic Playbook for the Education Section

How the guide section brings people to Mushroom Forage Map — in season and out — and what the
research says actually works in this niche. Companion documents: [PLAN.md](PLAN.md) (architecture
and roadmap), [SPECIES_TEMPLATE.md](SPECIES_TEMPLATE.md) (page format), and
[SPECIES_CONTENT.md](SPECIES_CONTENT.md) (compiled species research).

## 1. The demand landscape

What people actually search for, and when:

- **Identification intent dominates.** "Mushroom identification", "what mushroom is this", and
  "is X edible" queries are the core of the niche. r/mycology (~900k members) is almost entirely
  ID requests — a direct proxy for search demand.
- **Yard and safety panic queries run year-round.** "Mushrooms growing in my yard", "are yard
  mushrooms dangerous to dogs" — location-agnostic, season-agnostic, and exactly the off-season
  traffic this section is meant to capture.
- **Species names carry steady volume.** Morel, chicken of the woods, chanterelle, hen of the
  woods, oyster, lion's mane, turkey tail, reishi are the most-searched North American species.
- **Health/functional queries are large and growing.** UK searches for lion's mane spiked 450% in
  one month off TikTok coverage; the functional-mushroom market grows ~12%/yr. (This sub-niche is
  crowded with supplement brands — cover it honestly rather than competing on hype.)
- **Seasonality is a double spike.** Spring (March–June) belongs to morels — the single biggest
  search event of the niche. Fall (Sept–Nov) is peak diversity. Poisoning news events (e.g. the
  Dec 2025 California death cap outbreak) create sudden ID-intent surges.

**The proof this works:** a mushroom education brand grew from 1,100 to 62,800 monthly visitors in
7 months by building a templated, science-sourced species wiki (Growth Machine case study). Two
small map-plus-guide sites — mushroomtracker.ca and fungiatlas.com — already rank with seasonal
calendars and poisonous-species guides, validating the exact model this site is pursuing.
(Caveat from the species research: both read as AI content farms — cite them as market evidence
that these queries are winnable, never as factual sources. Beating them on quality is the
opportunity.)

## 2. Strategy in one paragraph

Species guides capture search, Google Lens, and AI-citation traffic; the live map is the
linkable, AI-proof asset that text-only competitors and AI Overviews cannot replicate. Every
guide page feeds the map ("see recent sightings"), and every map interaction feeds the guides
("learn to identify this"). The Great Morel has run this play since 1999 — its community
sightings map gets cited by NPR and local media every spring. Our equivalent is the rolling
90-day field signal, which no static field guide has.

## 3. What ranks in this niche (build these formats)

Ordered by fit with what we already have:

1. **Per-species guide pages** — the wiki model. Photos, ID characteristics, habitat, season,
   range, lookalikes, edibility, uses. See SPECIES_TEMPLATE.md.
2. **Seasonal calendar backed by live data** — "what's fruiting now near you." Competitors
   publish static calendars; ours can be driven by real observations. Both a ranking page and a
   repeat-visit hook.
3. **Lookalike / safety comparisons** — "false morel vs morel", "deadly mushrooms that look
   edible". High intent, high stakes, currently ranked by extension-office PDFs — beatable with
   better side-by-side photos.
4. **Regional/seasonal hubs** — "spring mushrooms of the Rockies", "poisonous mushrooms in
   [region]". Only publish where observation density justifies a page (see thin-content rules).
5. **Listicles** — "12 beginner-safe edible mushrooms". Still rank, and listicles are heavily
   cited by LLM search (one 400M-citation study put them at ~63% of citations).

## 4. SEO mechanics checklist

### The SPA problem (fix first — this gates everything else)

The frontend is a client-rendered Vite SPA that rewrites meta tags in JavaScript. That is the
wrong default for a content section:

- Googlebot's JS rendering is deferred and less reliable at scale; client-set titles/canonicals
  are unreliable.
- **AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute JavaScript at all** — a
  client-rendered guide is invisible to LLM search and citations.

Fix: **prerender every guide route to real HTML at build time.** Species pages change rarely, so
static generation at deploy is a perfect fit. Keep the interactive map as an SPA — it doesn't
need to rank as content. Implementation options are compared in PLAN.md. Whatever the mechanism,
every guide URL must serve correct `<title>`, meta description, canonical, and OG tags in the
response, plus an XML sitemap and plain crawlable `<a href>` links between pages.

### Programmatic pages without the thin-content trap

- Set eligibility criteria before templating: a species gets a page only when we have real
  photos, real range/season data, and real lookalike info. 20 excellent pages beat 500 stubs.
- Target ≥500 unique words and meaningful per-page differentiation. Our unique injectable data:
  live observation counts, "last spotted" recency, and a monthly sighting histogram per species.
  No competitor page has this.
- Don't pre-generate species × region combinations; add region pages as observation density
  earns them.

### Structured data (2025–2026 reality)

- **Skip FAQ and HowTo markup** — both rich-result types are dead or dying in Google Search.
  Keep Q&A *content* on the page (AI systems extract it regardless of schema).
- **Do add:** `Article` (with `author` → `Person`), `ImageObject` (critical — see below),
  `BreadcrumbList`, `Organization`/`WebSite`, and `Dataset` for the observation data itself —
  genuinely rare markup that fits this site.

### E-E-A-T for a poisoning-risk topic

Edibility is YMYL content; Google's 2025 rater-guideline updates raised the bar. Concretely:

- Named author, plus a "Reviewed by" line — a local mycological society member or mycologist
  reviewer is achievable for a small operator and is worth actively recruiting.
- "Last reviewed [date]" stamp on every edibility page.
- Cite primary sources: NAMA, university extension services, toxicology literature.
- Prominent poison-control callout (already a design principle of this site).
- An About page explaining who runs the site and how community review works.

### Image SEO — disproportionately important here

Mushroom ID is visual-first: Google Lens handles ~20B visual searches/month, and Lens users
photograph a mushroom and land wherever the best-matching images live. Checklist:

- Descriptive filenames (`morchella-esculenta-cap-closeup.webp`) and species-plus-feature alt
  text.
- Multiple angles per species: cap, underside (gills/pores/teeth), stem, cross-section, spore
  print, in-habitat shot, and young + mature specimens.
- WebP, `ImageObject` schema with license info, image sitemap.
- Original community photos are an asset stock-photo competitors cannot copy.

### AI Overviews — what to expect

AIOs cut informational-query clicks by roughly a third or more, and only ~1% of AIO views click a
cited source. What still earns clicks: interactive tools and maps, photo comparison, and
community content. Being cited in AIOs still lifts brand clicks (~35% in one study). Implication:
pure "what is lion's mane" text will bleed to AI answers; the map, live season data, and photo
comparisons are the defensible core, and the guides exist to feed them.

## 5. Linkable assets and channels, ranked for a small operator

**Tier 1 — do first:**

1. **The live sighting/season-progression map as THE linkable asset.** Pitch "morel progression
   [year]" to local news and outdoor media every spring; publish annual recap maps as evergreen
   link targets (The Great Morel's yearly archives are the model).
2. **Data-driven seasonal calendar** ("what's fruiting now") — see formats above.
3. **Season-alert email newsletter** ("morels reached your area") — the retention mechanism that
   converts seasonal spikes into a durable audience.

**Tier 2 — good payoff, low effort:**

4. **Mushroom ID quiz.** Wild Food UK and First Nature run popular ones; the Oregon Mycological
   Society actively recommends quizzes for skill-building — societies link to good ones.
5. **Printable one-page field cards** per species/season. (Inference, not case-study-backed, but
   cheap to derive from species data and a natural Pinterest/club fit.)
6. **Mycological society partnerships.** NAMA lists 90+ affiliated clubs with linkable
   directories; offering clubs free embedded local maps or event listings is a natural
   authority-link play that also fits our existing community/clubs feature.
7. **Reddit/Facebook presence.** r/mycology ~900k members; morel Facebook groups run 57k+ each.
   Reddit is a top AI Overview citation source. Participate genuinely; don't spam.

**Tier 3 — real but higher effort:**

8. **YouTube** — the niche's biggest proven channel (Learn Your Land ~572k subs, FreshCap 15M+
   views) but demands sustained on-camera fieldwork.
9. **Pinterest** — fits recipes/field cards; no foraging-specific traffic case study found.
10. **TikTok/short-form** — demand spikes are real, but virality accrues to creators, not sites.

## 6. Seasonal content calendar

| Window | Push | Content |
|---|---|---|
| Feb–Mar | Pre-season | Refresh morel guide + progression page; pitch media; "how to get ready for morel season" |
| Apr–Jun | Spring spike | Morel progression updates, false morel comparison, spring species pages live |
| Jul–Aug | Monsoon/summer | Boletes, chanterelles, lobster; "summer rain flush" explainer |
| Sep–Nov | Fall flush | Fall species hub, "October is peak season" push, yard-mushroom content for lawn flushes |
| Dec–Jan | Off-season | Cultivation (oyster/lion's mane kits), health-evidence explainers, ID-skills quiz, annual sightings recap, glossary |

## 7. Measurement

- Search Console on day one; track guide-page impressions/clicks separately from the map.
- Watch: indexed guide pages, species-page CTR, image-search impressions, newsletter signups per
  seasonal push, and inbound links to the progression/calendar pages.
- Evidence gap flagged by research: exact keyword volumes weren't verifiable with free tools —
  worth one session in Google Keyword Planner to prioritize species page order with real numbers.
