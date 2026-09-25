# September audit implementation

## Delivered in this release

- Account-scoped private queries, cancellation on identity changes and no-store private API responses. Private workspace forms also remount on identity changes to discard unsaved drafts. Covers notebook, saved places, watches, pantry, journal, sessions, moderation and membership.
- A daily incremental changed-record import, separate from the existing resumable full reconciliation. Full reconciliation retains retirement of deleted/private/downgraded records. No database migration is required.
- `/api/data-status`, visible stale/backlog information and a daily GitHub Actions check. Initial HTML no longer freezes observation counts, today's date or moon phase at build time.
- Explicit/selectable hemisphere for fungi seasonal charts; unknown/equatorial countries prompt for a choice. Timing-only herb watches say “Your selected timing matches.”
- Prerendered `/herbs/gathering-ways`, metadata, sitemap, readable reference export and legacy-link redirect. Private fieldbook views have noindex responses.
- Five stable destinations in both mobile bars. Herb private tools are grouped under My fieldbook. The fungi phone map icon is visible; skip links and map recovery are available.
- One generated plant catalogue for both frontend and backend. Pantry/wishlist cover 37 non-toxic profiles; all 44 remain in the atlas, map and journal. Watches remain explicitly limited to 12 plants until regional timing models are reviewed.
- Long immutable cache headers for hashed assets and lazy private herb views. Consent-gated LCP, INP and CLS measurements, guide-to-map and empty-result recovery events; custom events exclude notes, search text, coordinates and account identifiers.
- Post-production IndexNow submission, guarded by the frontend release SHA. Submission is not proof of indexing.
- Public 74-profile review queue, evidence requirements for recorded reviews, and scoped field-description citations for five previously single-source fungi profiles. Expert review remains pending.
- Compatible patches for js-yaml and @humanfs/node build-tool advisories; npm audit reports no known vulnerabilities at verification.

## Release and operational checks

1. Deploy backend and frontend from the same commit through the existing Vercel integration. No new secret is needed; both import routes use existing CRON_SECRET.
2. Verify `/api/data-status` after the first incremental run. Daily 11 UTC incremental and 12 UTC reconciliation schedules fit the once-per-day scheduling tier. Scheduler delays and page caps can exceed the desired 24-hour target: **do not advertise a guaranteed latency**. Status turns stale after 26 hours or an importer error. Raise frequency only after checking the hosting plan and measured source volume.
3. If an incremental cycle is partial, preserve its cursor; inspect `inaturalist_incremental` logs and resume it. Never overwrite covered-through to make the monitor green. On first deployment, historical gaps are still being reconciled.
4. Enable/watch GitHub Actions failure notifications for Production quality. The 14:30 UTC daily check fails on stale data, incomplete incremental runs, endpoint failures or malformed timestamps. It does not measure the whole upstream universe or replace full reconciliation monitoring.
5. Check the deployment-status event uses environment `Production`. Confirm `release.json` matches the published frontend SHA and the discovery job runs. If the integration emits no event, manually run `npm run indexnow -- --submit` from frontend after checking the published release.
6. Confirm GA4 is configured and analytics consent works. Register event-scoped custom dimensions `metric_name`, `metric_rating`, `collection`, and custom metric `metric_value`. Report p75 by metric/device/page group; CLS is a unitless value, LCP/INP milliseconds. No score has been inferred from bundle size.

## Work that requires people, field evidence or account access

### Specialist review

All 74 profiles still await independent specialist review. `frontend/src/data/editorialReviews.json` accepts only completed review records. Each record needs reviewer, credentials, ISO date, regional scope and an HTTPS evidence link. Obtain consent to publish the reviewer identity. Review the complete claims, preparation, lookalikes and diagnostic imagery; a source-link check is not a review. Require a second editorial approver in the content PR and retain the signed review/corrections record.

First commission dangerous pairs: edible Amanita versus deadly Amanita; morel versus false morel; puffball versus young Amanita; wild garlic versus lily-of-the-valley/autumn crocus; edible Apiaceae versus hemlocks; purslane versus spurge. Then highest-use culinary profiles and regional variants. The new MushroomExpert references support morphology/ecology only, not edibility. King bolete, rainbow chanterelle and gem-studded puffball still need stronger verified references; source fetches did not complete in this pass. No institutional endorsement or completed expert review is claimed.

### Regional expansion

Prioritize underserved Africa, South/Southeast Asia and Oceania. Publish a country/habitat guide only after a local reviewer supplies scientific and local names, native/introduced status, dangerous local comparisons, stage-based seasonal evidence, current access/conservation authorities, and credited diagnostic photographs. Fifteen existing herb profiles need additional life-stage views. No automated generic location-page expansion or unlicensed image reuse is appropriate.

### Discoverability baseline

Search Console, Bing Webmaster Tools and private analytics access were unavailable. In those accounts, establish the baseline below, submit the sitemap and inspect representative canonical pages. Check exclusion reasons before changing content. Verify OAI-SearchBot access using actual request logs and documented crawler identities; user-agent spoofing alone proves nothing. Partnerships/outreach have not been sent.

| Weekly metric | Baseline | Target/interpretation |
| --- | --- | --- |
| Indexed canonical pages / submitted | Not measured | Inspect exclusions by collection and region |
| Search impressions, clicks, useful queries | Not measured | Compare 28-day periods by content group |
| Guide-to-map events / consenting guide visits | Not measured | Improve useful field journeys |
| Empty-result recovery and repeat visits | Not measured | Preserve consent and privacy |
| p75 LCP / INP / CLS | Not measured | ≤2500ms / ≤200ms / ≤0.1 |
| Linked AI citations and attributable referrals | Not measured | Separate mentions, citations and visits |
| Completed independent profile reviews | 0 / 74 | Prioritize safety-critical comparisons |
| Incremental covered-through lag | First run pending | Aim <24h; alert >26h |

Use a fixed monthly sample of questions (regional season, dangerous lookalike, habitat, permissions, beginner learning and observation interpretation) across relevant assistants. Record model, date, prompt, linked citations and landing page. This sample cannot establish universal rank. No number-one LLM recommendation is promised.

## Verification

- Production frontend build and ESLint passed; 48 frontend tests passed, including privacy cancellation/account-switch regressions, catalogue parity, routing, 116 canonical pages, sitemaps and source anchors.
- 32 backend tests passed; authentication/account/pantry and full importer smoke tests passed. Expanded pantry API checks accept wild garlic and reject toxic/unknown records. Private unauthorized responses retain no-store headers.
- A read-only upstream request verified iNaturalist accepts the new changed-since/descending filter (HTTP 200). No production import was triggered.
- Browser checks: phone map icon and one-row navigation; Gathering Ways and fieldbook navigation; hemisphere selector with northern/southern API requests; real map rendering; visible stale-data disclosure; local API outage with retry/fallback. No horizontal overflow in sampled phone layouts.
- These checks are not specialist field review, a complete accessibility certification, payment/email end-to-end testing, or a measured Core Web Vitals score.
