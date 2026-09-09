# Global herb observation map

The public `/herbs/map` page covers the 44 profiles in the plant atlas. The collection switch opens `/learn` for Fungi and `/herbs` for Herbs; both menus put the collection landing page first and Field map second. The existing root mushroom map remains available at `/`.

## Records and taxonomy

The source is the unauthenticated [iNaturalist v1 API](https://api.inaturalist.org/v1/docs/). All 44 scientific identities were checked against the live taxonomy on 9 September 2026; IDs and accepted names are in `src/data/herb-map-taxa.json`. In particular, roselle maps to the currently accepted *Sabdariffa gossypiifolia*, taxon 1687652. Descendants of each selected taxon are included. Atlas categories remain reference categories, not an identification verdict.

The service requests georeferenced, wild (`captive=false`), research-grade records with CC0, CC BY or CC BY-SA observation licenses. Photographs are displayed only when their own license is one of those three, with creator attribution and a license link. A missing permitted photograph leads to the original observation. Excluding other licenses reduces displayed coverage.

Each search retrieves at most 200 recent matching records, ordered by observation date. A viewport crossing the antimeridian makes two bounded requests, deduplicates by observation ID, sorts and caps the combined display at 200. The source total and displayed count are separate. Clusters count only the records loaded, not every observation in the area. An empty result never asserts species absence or harvest availability.

## Privacy and operational limits

Only `geojson` public points are copied. Private locations are excluded; private coordinate fields are never read or returned. Obscured points keep their public position but omit the original place description and reported accuracy. No observation authentication or user token is sent to the source. Country detection uses the existing coarse visitor-country endpoint; precise geolocation remains an explicit map-control action.

The public `/herb-observations` Vercel function validates the plant allowlist, date/month filters and finite bounds; unsupported inputs fail before any source request. Dates use UTC. Bounds round outwards to a tenth of a degree to reuse searches. Panning does not fetch automatically: visitors press Search this area. Place selection moves the camera; the area search then loads records.

Successful responses are cached by the Vercel CDN for ten minutes with one hour of stale-while-revalidate. Each warm instance also maintains a bounded 128-entry cache, coalesces identical requests, allows at most four pending distinct searches and spaces upstream requests by at least 1.1 seconds. This is per-instance pacing, not a globally coordinated quota. Review upstream usage if traffic grows; a shared queue/budget would be needed before approaching iNaturalist's recommended ~10,000 API requests/day. Error responses are not cached and request a 60-second retry delay. Provider fetches time out after eight seconds; no unbounded pagination or client retries occur.

See [iNaturalist API recommended practices](https://www.inaturalist.org/pages/api+recommended+practices). The source, record/license links, coverage limitations and retrieval timestamp are also visible in the map UI.

## Verification

`npm run test:map` covers taxon coverage, navigation destinations, input validation, date and license filters, antimeridian queries, private/obscured data, toxic categories, image reuse, bounded pagination and source failures. `npm run build` prerenders the public map and includes it in the sitemap, reference index and IndexNow manifest. Browser QA checks shared header coordinates, compact navigation, real provider records and country camera behavior on a Vercel preview with its public Mapbox configuration.
