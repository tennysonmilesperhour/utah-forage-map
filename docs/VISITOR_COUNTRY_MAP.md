# Country opening view

The field map starts on the visitor's approximate country, obtained from Vercel's `x-vercel-ip-country` header through the same-origin `/visitor-country` function. The endpoint returns only a two-letter country code, with private/no-store browser and CDN headers. It does not return or store an IP address, city, or coordinates. No device-location prompt is triggered. A VPN or proxy can affect the detected country; manual place search and the existing opt-in locate control remain available.

Region links and observation links skip this default. A place selected while detection is pending takes priority. The country is used only in the Mapbox constructor; it cannot pull the map back after a pan, search, filter change, or delayed response. Detection is bounded to 2.5 seconds and falls back to the existing world view if unavailable.

Primary-area bounds for 173 countries come from [sandstrom/country-bounding-boxes](https://github.com/sandstrom/country-bounding-boxes), a public-domain extraction of Natural Earth 110m country data, retrieved 9 September 2026. These are opening camera extents, not geopolitical boundary geometry. Remote territories are omitted from primary-country framing; the US opens on the contiguous states. Russia and Fiji use primary-land extents to avoid a 360-degree box at the antimeridian. Latitudes are clamped to the existing map limits. Country codes outside this table use the existing Mapbox geocoder with a country-only query; results remain in memory and are not persisted.

References: [Vercel country headers](https://vercel.com/docs/headers/request-headers#x-vercel-ip-country), [Mapbox initial bounds](https://docs.mapbox.com/mapbox-gl-js/api/map/), [Mapbox country geocoding](https://docs.mapbox.com/api/search/geocoding/).

Validation: `npm run test:map` covers private responses, global bounds validity, small-country fallback, network failures/timeouts, and precedence of explicit destinations. Preview verification must also confirm the frontend function is served locally rather than passed through the generic backend API rewrite.
