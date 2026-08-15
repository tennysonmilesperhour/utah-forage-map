# Species Page Template

The per-species page format for the education section, synthesized from how the best mushroom
education sites structure their pages and what users consistently praise or complain about.
Research sources and the full site-by-site comparison are summarized at the end.

## Design intent

Concise by default, depth on demand. The sites people love are either short-and-visual (Wild
Food UK) or deep-but-charming (MushroomExpert.com); the failure mode is long-and-bland. Every
page should be scannable in 30 seconds and rewarding for 5 minutes.

## Page structure (top to bottom)

### 1. Header block

- Common name(s), scientific name, notable synonyms.
- **Author byline with credentials and a "Last reviewed [date]" stamp.** The community's #1
  current fear is anonymous AI-generated foraging content — a named, dated, reviewed byline is
  the single strongest trust differentiator right now.
- **Two-axis edibility badge:** edibility tier (choice / edible / edible with caution /
  inedible / poisonous / **deadly**) *plus* ID-difficulty tier (beginner-safe / intermediate /
  expert-only). Separating "how good is it" from "how hard is it to be sure" is emerging best
  practice. Icon + color + text label — never color alone (existing accessibility principle).
- If a dangerous lookalike exists: a persistent "Deadly lookalike: [species]" banner linking
  down to the comparison section.

### 2. Quick-facts strip

Fielded, scannable (Wild Food UK / ForagingTexas style): season, habitat and tree
associations, spore print color, cap width range, height, abundance, region.

### 3. Live data panels — our unique asset

Computed from the observation database, the way iNaturalist computes seasonality and similar
species rather than hand-writing them:

- Seasonality histogram from found dates ("most observations near you are Sep–Nov").
- Recent-observations mini-map for the species, linking to the full map filtered to it.
- Region awareness where possible — lookalikes and seasons differ by continent, and a
  worldwide site must not make single-region claims (e.g. "jack-o'-lantern is rare here" is
  true in Britain and false in Texas).

### 4. Identification section

Field order follows First Nature / Kuo convention: **Cap → Gills/pores/teeth (including
attachment) → Stem (ring? volva? — "always check the base" callout) → Flesh (color change when
cut) → Smell and taste → Spore print (link to the how-to page) → Habitat and ecology →
Season.**

Photo requirements (the most common expert complaint is guides showing only mature, perfect
specimens):

- Young **and** mature specimens — young caps can hide gills; old caps fade and erode.
- Underside, cross-section, and an in-habitat shot.
- Caption each photo with the diagnostic feature it demonstrates.
- Note in text the features photos can't carry: smell, texture, bruising color change, the
  buried volva.

### 5. Lookalikes — the heart of the page

The single most-praised feature across every site and review researched. One card per
confusable species:

- Side-by-side photos.
- A plain-language "how to tell them apart" sentence (Wild Food UK's "Possible Confusion"
  model: "false chanterelle is more orangey and lacks the white flesh").
- A severity tag on each lookalike: harmless / sickener / **deadly**.
- A region note where relevant ("common in Europe, absent from western North America").
- When a species genuinely has no dangerous lookalikes, say so explicitly — don't omit the
  section.

### 6. Uses

- **Culinary:** flavor and texture, cleaning and storage, cooking notes, required preparation
  (e.g. morels are toxic raw), linked recipes when available. Always include the convention:
  cook all wild mushrooms; try a small amount the first time.
- **Medicinal/supplement:** honest evidence status only — e.g. lion's mane cognition research
  is preliminary. Never supplement-marketing tone; content farms shilling supplements are a
  documented anti-pattern that destroyed other sites' credibility.
- **Other uses:** dyeing, cultivation potential (oyster and lion's mane are
  beginner-cultivatable — good off-season content), ecology and cultural history.
- **For toxic species:** why the species still matters — toxin mechanism, medical urgency,
  history. These pages serve safety searches ("mushroom in my yard") and are often the
  highest-traffic pages.

### 7. One memorable fact

Each page carries at least one genuinely interesting fact (etymology, ecology, history).
First Nature's etymology notes are a beloved memory aid; personality is why Kuo's dense
material sticks. A collapsible "name origin" note is a cheap win.

### 8. Safety footer (every species page)

- The 100% rule, on-page and not just in a legal footer: never eat anything unless completely
  certain, never from one source, never from this website alone.
- Link to the full site disclaimer, the poison-response page, and a local mycological society
  finder.

## Writing guidelines

- **Tone:** plain-language brevity in the fielded sections, a dash of personality in the
  intro prose, blunt in warnings ("could make you sick or kill you" — the Missouri Dept. of
  Conservation convention). Matches the site's existing "field desk" voice: knowledgeable
  without being academic.
- **Length:** roughly 500–900 unique words of prose per species (enough substance to rank and
  to be worth reading; short enough to stay scannable). Structure carries the depth, not
  paragraph count.
- **Inline warnings at the point of danger,** not only in global banners — put the kill
  warning inside the lookalike card, the "toxic raw" note inside the culinary section.
- **Genus-first teaching** where it helps: mycologists consistently advise learning genus
  before species. Group pages ("boletes", "amanitas", "little brown mushrooms — don't bother")
  are valuable connective tissue.
- **Never present edibility myths uncritically** — actively debunk "cooking makes anything
  safe" and "animals ate it so it's fine."

## Site-wide supporting pages (referenced by the template)

| Page | Why |
|---|---|
| Beginner hub: "start with these" | Funneling novices to ~6 hard-to-mistake species is a recurring expert recommendation |
| Spore print how-to | Load-bearing skill referenced from every ID section |
| "What's in my yard?" | Year-round safety traffic; Kuo's version is a famous on-ramp |
| Major groups orientation | Simplified genus-level keys (gilled/pored/toothed/…) |
| Glossary with hover definitions | Jargon is the #1 accessibility barrier for beginners |
| Poison response page | Poison Control 1-800-222-1222 (US), save a specimen, the delayed-onset amatoxin trap |
| /disclaimer page | The standard liability stack (see PLAN.md trust framework) |
| "How we verify content" | Names authors, reviewers, and the review process — the anti-slop trust page |

## Research basis (summary)

**What the best sites do:** MushroomExpert.com — dichotomous keys, rigor plus humor, two
decades of updates. Wild Food UK — short fielded pages with a dedicated "Possible Confusion"
lookalike section, ID videos, recipes, seasonal charts. First Nature — consistent field order,
etymology, spore data, 600+ species from a named credentialed author. Forager Chef —
ID-through-to-plate narrative with chef-grade recipes. iNaturalist — seasonality and similar
species computed from observation data (the model our data panels follow). Missouri Dept. of
Conservation — regional scoping and blunt inline warnings. ForagingTexas — terse fielded
format including "abundance" and "dangers" fields. Mushroom Observer — transparent
confidence-weighted community consensus as the trust mechanic.

**What users consistently praise:** side-by-side lookalike treatment; depth from named
experts; personality that makes dense material stick; genus-first teaching; community
verification over algorithms (photo-ID apps tested at ≤49% accuracy, and poisonings have
followed app misidentification); data-driven seasonality; recipe integration; "safe six"
beginner curation.

**Anti-patterns to avoid:** anonymous authorship and AI-slop smell (the 2023 Amazon
AI-foraging-book scandal made this a community flashpoint); photos of only mature specimens;
photo-only pages that skip smell/bruising/spore print; no regional scoping; content-farm
supplement shilling; uncritical edibility myths.
