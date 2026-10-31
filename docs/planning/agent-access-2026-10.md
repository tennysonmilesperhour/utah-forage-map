# Agent access plan (October 2026)

Goal: let AI assistants (ChatGPT, Claude, Perplexity, Gemini), AI crawlers and other automation find, read, trust and cite World Mushroom Foraging, without ever making a map observation sound like an identification or an edibility decision. Then review it every week and improve one thing at a time.

## Research (October 2026, re-check before relying on it)

- The large AI crawlers rarely read `llms.txt` and Google ignores it. Agents that a person sends to a site do read it. Keep it short and point to small topic files. Server-rendered HTML stays the main surface.
- AI answers cite original data (numbers nobody else has), fresh pages with visible dates and open pages. Paywalled sources got no citations in one test.
- No major assistant pays per request. Do not paywall or charge agents. If paid access ever makes sense it is bulk or history data behind a Stripe API key or a paid MCP tool priced well above payment fees (about $0.01 to $0.05 a call). Not now.
- Worth adopting: schema.org Dataset and DataCatalog markup, a read-only remote MCP server, Content Signals in robots.txt. Skip agents.json and ai-plugin.json.

## Decisions

1. Open, free, citable. Compiled data is CC BY 4.0. Guide text may be quoted with a link but not republished in full. Photos keep their own licences.
2. No edibility answers. No tool or file returns an edibility rating, identifies a mushroom from a photo, or returns exact locations. The `edibility` field in the guide front matter is deliberately left out of datasets, the MCP data file and the markdown twins. Every agent-facing output carries the notice: "A map observation is not an identification. Never eat a wild mushroom based on this data."
3. iNaturalist-derived counts are aggregated only (per species, hemisphere and month; per region). Hemisphere rows need at least 30 records and the species at least 10 people. The data pipeline reads iNaturalist's open-data export, which includes observations with CC0, CC BY and non-commercial licences and carries no per-record licence column. The CC BY 4.0 licence is therefore stated for our compilation only, with credit to iNaturalist and its observers. Open question for Tennyson: keep as is, or rebuild the pipeline with a photo-licence join that keeps only CC0, CC BY and CC BY-SA records.
4. Neon, not Supabase. The traffic table and three SQL functions live in Alembic migration `a1c5d9e03f72`; migration `b7e4c2a91d05` (31 Oct) adds the `mcp_tool` column, a five-argument `agent_traffic_log` and an `mcp_tools` list in the summary. Only the tool name is stored, never its arguments. Neon has no `auth.role()`, so access control is in the API: writes need `AGENT_LOG_SECRET`, reads and prune need the service credential (`CRON_SECRET` bearer token) or a signed-in admin. Table and function privileges are revoked from PUBLIC.
5. Logging is by hosting middleware (`frontend/middleware.js`) for known bots and tools only. A normal browser is never logged, even when it opens `/llms.txt`. Unknown non-browser clients that fetch agent files are logged as agent `unknown`.
6. Robots: all AI crawlers allowed, `Content-Signal: search=yes, ai-input=yes, ai-train=yes`. Change `ai-train` here and in `frontend/public/robots.txt` if that ever needs to be narrowed.
7. Lookalike severity has one meaning everywhere (since 31 Oct): the worst outcome if the two species are mixed up, in either direction, on the scale harmless, caution, toxic, deadly. Both pages of a pair print the same word, and it is never milder than the more dangerous species (floor: deadly for deadly species, toxic for poisonous, caution for edible-with-caution). Every linked lookalike is listed back. The backlog's first wording ("how dangerous the lookalike is") was not used because it would print "harmless" next to edible species on a death cap page and turn the label into an edibility rating. `frontend/tests/lookalikes.test.mjs` enforces all of this.

## What shipped

| Piece | Files |
| --- | --- |
| Accuracy fixes | `frontend/content/species/05-oyster-mushroom.md`, `71-matsutake.md` (understated severities), 20 lookalike links added across species files, README cron, consent and API list |
| llms.txt and topic files | `frontend/scripts/build-agent-access.mjs` writes `dist/llms.txt` (under 10 KB) and `dist/llms/*.txt` (each under 60 KB) |
| Markdown twins | same script, `dist/<route>.md` (home is `/index.md`); `<link rel="alternate" type="text/markdown">` added in `frontend/scripts/prerender.mjs`; `Link: rel="canonical"` header set in `frontend/middleware.js`; HTML to markdown walker in `frontend/scripts/lib/markdown.mjs` |
| Open data | `frontend/scripts/lib/agent-data.mjs`, `frontend/scripts/build-open-data.mjs`, files under `/data/*.json` and `*.csv`, catalog `/data/index.json`, page `/data` (`DataPage` in `frontend/src/GuideApp.jsx`) with DataCatalog and Dataset JSON-LD |
| Live regional signal | `GET /api/open-data/regional-signal` in `backend/app/main.py` (counts only; species with fewer than 3 recent records left out) |
| MCP server | `frontend/server/mcp.js`, `frontend/api/mcp.js`, route `/mcp` in `frontend/vercel.json`; data file generated by `frontend/scripts/build-open-data.mjs` into `frontend/server/agent-data.generated.json` |
| Traffic log | `backend/app/agent_traffic.py`, migration `backend/alembic/versions/a1c5d9e03f72_agent_traffic_log.py`, endpoints `POST /api/agent-log`, `GET /api/admin/agent-traffic`, `POST /api/admin/agent-traffic/prune`, bot table `frontend/server/agent-bots.js` |
| Discovery | `frontend/public/robots.txt`, `/.well-known/api-catalog` (RFC 9727 linkset), `/.well-known/mcp/server-card.json`, `Link` headers in `frontend/vercel.json` |
| Weekly export | `.github/workflows/agent-review.yml`, `frontend/scripts/agent-review.mjs`, output `docs/agent-review/YYYY-MM-DD.json` |
| Tests | `frontend/tests/agent-access.test.mjs`, `frontend/tests/agent-build.test.mjs`, `frontend/tests/lookalikes.test.mjs` (`npm run test:agent`), `backend/tests/test_agent_traffic.py` (set `TEST_POSTGRES_URL` to also test the SQL functions; CI does) |
| Added 31 Oct | Uniform lookalike severities and 76 back links; MCP tool names in the traffic log (migration `b7e4c2a91d05`, middleware reads the name only); `/data/herb-seasonality.json` and `.csv`; the weekly export keeps that week's regional signal in `regional_signal`; `/learn/species/wood-ear` redirects to `/learn/species/jelly-ear` |

Setup only the owner can do: set `AGENT_LOG_SECRET` (the same random value) on both Vercel projects; add `CRON_SECRET` as a GitHub Actions secret (same value as the API project's `CRON_SECRET`); run `alembic upgrade head` on Neon (again after 31 Oct, for migration `b7e4c2a91d05`). Until `CRON_SECRET` is set every export shows traffic `available: false`, and until `AGENT_LOG_SECRET` is set no rows are written at all.

## Weekly review steps (Monday)

The export Action runs at 15:50 UTC and the scheduled review session at 16:25 UTC.

1. Read the newest `docs/agent-review/YYYY-MM-DD.json`: problems list, traffic by bot and kind against the previous period, top paths, agent-file and `/mcp` use, unknown user agents, daily counts. If traffic shows `available: false`, note it and check the secrets.
2. Test 10 to 15 real questions (list below) in web search and in the assistants you can reach. Note who is cited, whether this site appears, and whether any answer states something wrong that came from us.
3. Accuracy audit on one rotating area (rotation: lookalike severities, species seasons and warnings, foraging guides, herb atlas toxic references, region pages, README and docs counts, dataset numbers). Fix wrong facts at the source.
4. Freshness check: content check dates, snapshot date of the iNaturalist summary (2026-08-27), sitemap lastmod, `llms.txt` key facts against `catalogue-counts.json`.
5. Build one improvement (the smallest useful one from the backlog). Run lint, tests and build, push, open a draft pull request.
6. Add a line to the review log below. Keep outward-facing changes beyond this plan (posting, outreach, paid access, licence changes) as recommendations for Tennyson.

## Common questions to test

- When is morel season in Oregon, and where do morels fruit after a burn?
- What does a false morel look like compared with a true morel?
- What are the lookalikes of the death cap?
- How do I tell a chanterelle from a jack-o'-lantern?
- What mushrooms are in season in Western Europe right now?
- What mushrooms fruit in autumn in New Zealand?
- Is a map pin enough to identify a mushroom?
- What should I do after eating a wild mushroom I am unsure about?
- How do I tell oyster mushrooms from angel wings?
- When is chicken of the woods in season in the northeastern United States?
- What are the Smith's amanita and matsutake lookalike risks?
- Where can I find open data on mushroom seasonality?
- Is there an API or MCP server for mushroom guides?
- What is the best month for porcini in the Rocky Mountains?
- Which wild plants in the atlas are toxic lookalikes of edible herbs?

## Backlog

- Done 31 Oct: lookalike severity labels uniform and both directions of each pair linked (76 back links written, 3 existing entries linked; see decision 7).
- Decide the iNaturalist licence question (decision 3) and, if needed, rebuild the occurrence summary with a licence join.
- Done 31 Oct: herb seasonality dataset (`/data/herb-seasonality`). Still open: a plant lookalike dataset.
- Done 31 Oct: MCP tool name (not arguments) in the traffic table. Needs `alembic upgrade head` on Neon; until then rows are logged without the tool name.
- Historical regional signal snapshots as a dataset (weekly, aggregated) so history is citable. No history existed on 31 Oct, so nothing was published; the weekly export now stores `regional_signal`, starting with the first export after this change is merged. Publish once about eight weeks exist.
- Done 31 Oct: the `33-wood-ear` guide is now `33-jelly-ear` (slug `jelly-ear`) with permanent redirects for the page and its markdown twin. Taxon check against the iNaturalist and GBIF APIs: jelly ear (1138427), indigo milk cap (1366733), blusher (1678242), weeping milk cap (1366740) and deer mushroom (1617451) use active iNaturalist complex ids named after the species shown; GBIF accepts each species name. Each complex also holds sibling species (for example Auricularia americana and A. angiospermarum for jelly ear, Amanita novinupta and A. flavorubens for the blusher), so the ids were kept and the complex name added as an alias. The jelly ear range layer is modelled on the species id 50813 because complexes have no Geomodel. Open question for Tennyson: show "complex" in the Latin name line, or keep the species name.
- Add `llms-full.txt` only if agents ask for it in the traffic log.
- Expert review: recruit a named mycologist and show their review date separately from the content check date.
- Done 31 Oct: stale counts refreshed in `docs/audit-implementation-2026-09.md`, `docs/MYCELIAL_DESIGN.md` and `docs/education/PLAN.md`; the illustrative Utah sightings, reports, events and clubs in `backend/scripts/seed.py` are written only with `--demo`. Rows an earlier production seed already wrote stay in the database until removed by hand.
- Done 31 Oct: taste-and-spit advice removed from the pine bolete, bitter bolete, sickener, shrimp russula and charcoal burner pages and the seed notes; they now give the site rule (never taste a wild mushroom to identify it) and point to features and a qualified local expert.

## Outlook

- 1 year: citations from at least two assistants for species and seasonality questions, 5 or more external references to `/data`, MCP use from real clients visible in the log, weekly review habit intact.
- 2 years: regional signal history published as a dataset, expert-reviewed guides with named reviewers, clubs and educators citing the open data. Revisit paid bulk access only if assistants begin paying or bulk users ask.
- 5 years: a standard open reference for mushroom phenology that research and assistants cite by default. Protocols will have moved on (MCP revisions, new discovery files), so re-check every decision here each year.

## Review log

| Date | Who | What changed | Notes |
| --- | --- | --- | --- |
| 2026-10-07 | Initial build | Agent access layer shipped (see What shipped). | Live checks and traffic rows pending the first deploy and secrets. |
| 2026-10-08 | Weekly export (log written 31 Oct from `docs/agent-review/2026-10-08.json`) | Nothing changed. | The export ran before the layer was live: `/data`, the data catalog, the markdown twin, `/.well-known/api-catalog`, the MCP server card and every MCP call returned 404; only `/llms.txt` answered (2,325 bytes, an earlier, smaller file). Traffic not available: `CRON_SECRET` is not set, so traffic logging and the summary are not configured. No question testing or accuracy audit was recorded. |
| 2026-10-12 | Weekly export (log written 31 Oct from `2026-10-12.json`) | Nothing changed. | Layer live: catalog and 4 static datasets 200 (seasonality 147 rows, lookalikes 320, species 108, regions 10), `llms.txt` 3,865 bytes, markdown twin with canonical Link, MCP initialize and all 5 tools 200 with the safety notice. One problem: `/api/open-data/regional-signal` returned 500, during the database connection problems fixed 13 to 16 Oct. Traffic not available (`CRON_SECRET` unset); prune skipped. No question testing or accuracy audit was recorded. |
| 2026-10-19 | Weekly export (log written 31 Oct from `2026-10-19.json`) | Nothing changed. | No problems. Regional signal back to 200. Same row counts as 12 Oct. Slowest MCP call `seasonality` at 824 ms (it calls the live API). Traffic not available (`CRON_SECRET` unset); prune skipped. No question testing or accuracy audit was recorded. |
| 2026-10-26 | Weekly export (log written 31 Oct from `2026-10-26.json`) | Nothing changed. | No problems; all checks 200 with the same row counts, MCP calls 122 to 300 ms. Traffic not available (`CRON_SECRET` unset), so there is still no evidence of which assistants or crawlers read the site. No question testing or accuracy audit was recorded. |
| 2026-10-31 | Backlog session | Lookalike severities made uniform with 76 back links and a reciprocity test; taste-test advice removed; `wood-ear` renamed `jelly-ear` with redirects; five complex taxon ids checked against iNaturalist and GBIF and kept; stale counts and demo seed rows fixed; MCP tool name logging (migration `b7e4c2a91d05`); herb seasonality dataset; weekly export keeps the regional signal. | Rotation area covered: lookalike severities. Still blocked on the owner: `CRON_SECRET` GitHub secret, `AGENT_LOG_SECRET` on both Vercel projects, `alembic upgrade head` on Neon. Without them the traffic table stays empty. |
