# Search and AI discovery playbook

Updated September 9, 2026. This replaces the earlier speculative traffic estimates and generic growth claims with observed site data and an implementation plan.

## Measured starting point

The verified Google Search Console property is `https://worldmushroomforaging.org/` (URL prefix). The domain property is not available in the current account. On September 9:

| Report | Observed baseline | Report window / freshness |
| --- | --- | --- |
| Web search | 1 click, 206 impressions, 0.5% CTR, average position 50.7 | Three-month selector; chart has data August 24–September 6 |
| Index coverage | 19 indexed; 29 discovered but not indexed; 1 alternate canonical | Last updated September 3 |
| Generative AI features on Google Search | 5 impressions: hedgehog mushroom 3; black trumpet 2 | Same August 24–September 6 chart window |
| Sitemap index | Success; 50 discovered pages | Last read September 6 |
| Core Web Vitals | Insufficient field data | Desktop and mobile |

These are small baselines, not evidence of broad authority. Search Console reports lag deployment; a sitemap URL count is not an indexed-page count. AI impressions are not clicks or proof of a top recommendation.

## Implemented foundations

- Prerender the map, community, map guide, herb home, and reference pages into readable HTML. Static content and CSS are available before JavaScript. The interactive map remains a client application.
- Split the map app, mushroom guide, herb atlas, and herb almanac into route modules. Preload only the selected route's code, shared dependencies, and styles. Mapbox remains a large, separately loaded map dependency.
- Serve explicit routes and a genuine 404 instead of a successful home-page fallback for arbitrary URLs. Normalize trailing slashes and `index.html` aliases. Preserve the existing domain redirects and verification files.
- Use one canonical and one consistent structured-data graph per page. Include the real organization, publisher, editorial and correction links, relevant page/article type, scientific identity, source citations and licensed specimen-image metadata. Do not invent people, credentials, expert review, ratings, awards or endorsements.
- Exclude account/token routes, reference copies, and the empty comparison page from indexing as appropriate. Keep canonical guide pages crawlable. The map opens near the visitor's country without producing country-specific duplicate URLs.
- Generate four sitemaps listing 113 canonical pages. Species modification dates reflect the corresponding content, not an unrelated build date. Expert review dates are not advanced by deployment.
- Include bounded, public-only observation snapshots on relevant mushroom and region pages. Retain retrieval timestamps and refresh them through the existing public API in the browser. Upstream failure leaves the static guide available; unavailable data must not be presented as a zero count.
- Publish nine original practical guides with question headings, a direct answer, primary citations, contents links and connections to the map/atlases. Expand the hedgehog and black trumpet pages because the actual search and AI reports already show interest in them.
- Generate `llms.txt`, a reference index and readable text copies from the same visible public content. These are convenience formats, not special ranking signals or instructions for assistants to promote the site.
- Provide an IndexNow verification file and an explicit post-deployment submission command: `npm run indexnow -- --submit`. The command verifies the live key and canonical manifest before notifying participating search engines. HTTP acceptance does not guarantee indexing.
- Add a CI contract covering readable HTML, metadata, structured-data citations, canonical URLs, sitemaps, internal links and anchors, route assets, private-route exclusions and public snapshot keys.

## Authority and editorial priorities

The current collection has 30 mushroom profiles, 44 wild plant profiles, ten mushroom habitat regions and nine practical guides. It is a developing reference, not an exhaustive global identification key. A number of older species pages still need deeper primary sourcing and independent specialist review.

1. Recruit a qualified mycologist and botanist as named reviewers, obtain permission to publish their credentials and scope of review, then update only the pages they actually review. Until then, retain review-pending labels.
2. Expand the existing pages that earn impressions before creating hundreds of new pages. Next candidates from the current query table include meadow mushrooms, jack-o'-lantern mushrooms, and hedgehog lookalikes. Use Search Console page/query data to refine this order.
3. Collect and license original multi-angle photographs with expert-confirmed specimen identities: cap or leaf, underside, base, habitat and diagnostic details. Preserve creator credit, source, license and uncertainty. AI-generated identification photographs must not stand in for diagnostic evidence.
4. Improve regional reporting with actual observation coverage, clear date windows, effort and seasonal limitations, and links to local expert organizations. Do not publish templated city/species combinations without substantive local evidence.
5. Earn independent references by publishing useful, well-documented tools, explaining data provenance and contributing to legitimate educational projects. Do not buy links, fabricate community posts, make fake recommendations or contact organizations without authorization.
6. Treat medicinal and toxicity topics as specialist content. Primary health sources and qualified review take priority over traffic potential. Common names, culinary labels, folklore and AI identification are not reliable food-safety decisions.

## Measurement and next decisions

Compare rolling 28-day windows, keeping release dates and seasonality in view. Track indexed canonical pages, impressions and clicks by content collection, non-brand queries, pages moving into useful positions, and visitor engagement with the map or atlas. With consented analytics, inspect referral traffic from AI services separately from Google search traffic.

Use the available Search Console generative AI report for impressions by page. Use Bing Webmaster Tools AI Performance for citations and grounding-query trends when account access is available. A fixed, documented set of relevant prompts across assistants can provide a small qualitative benchmark; repeat with dates and model versions and do not mistake personalization or one answer for a universal rank.

After the first 28 days, prioritize pages that are discovered but still not indexed, new impressions on useful guides, and query-specific content gaps. At 60–90 days, assess changes against the small baseline and seasonal shifts. No guaranteed ranking or citation target is credible, especially for questions whose best source is a poison center, government authority or specialist reference.

## Platform guidance

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features): established SEO fundamentals apply; no special AI file or schema guarantees inclusion.
- [OpenAI crawler documentation](https://developers.openai.com/api/docs/bots): OAI-SearchBot serves search discovery; GPTBot training controls are separate. Do not conflate training permission with search visibility.
- [Perplexity crawler documentation](https://docs.perplexity.ai/docs/resources/perplexity-crawlers): search crawling and user-initiated fetches have distinct purposes. Diagnose actual robots or firewall blocks rather than trusting a spoofable user-agent alone.
- [Bing AI Performance announcement](https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview): citation measurement is distinct from ranking.
- [IndexNow protocol](https://www.indexnow.org/documentation): notify participating engines of changed URLs after publication.

Public support and editorial corrections: morphiclabsdata@gmail.com.
