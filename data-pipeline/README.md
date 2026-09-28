# Occurrence squares, growing zones and the ID index

These scripts turn iNaturalist's public open data into the static files behind the map squares, the "Where it grows" sections and the Suggest-an-ID tool. Outputs are committed, so the site never calls these sources at runtime. The live herb map still queries the iNaturalist API for recent records, and the fungi map still reads the backend importer's recent sightings.

## Sources

- **Observations**: `observations.csv.gz` and `taxa.csv.gz` from the [iNaturalist Licensed Observation Images](https://registry.opendata.aws/inaturalist-open-data/) bucket on AWS Open Data (`s3://inaturalist-open-data/`). The export covers observations with openly licensed photos and gives only public coordinates; obscured records carry their obscured position. The 27 August 2026 snapshot held 276 million observations; 1.0 million research-grade fungi and 4.3 million research-grade plant records belong to catalogue species.
- **Expected range**: iNaturalist Geomodel thresholded range polygons, `geomodel/geojsons/latest/<species id>.geojson` in the same bucket (version 2.34 at the time of writing).
- **Land outline**: Natural Earth 1:50m and 1:110m land (public domain).

Only counts per grid square leave this pipeline. No observation IDs, observers or coordinates are published.

## Catalogue

`catalogue.json` lists every fungi guide and herb profile with the iNaturalist taxon the maps use. New entries were resolved against `taxa.csv.gz`. When iNaturalist files most records under a complex of the same name (for example the ramps complex), the complex is used so its records count; `speciesTaxonId` keeps the species used for Geomodel. Descendant taxa count toward their nearest catalogue ancestor, as on the live herb map.

## Steps

Run from the repository root with a work directory outside the repo (the observation files are large).

```bash
WORK=/path/to/work
curl -sS -o $WORK/taxa.csv.gz https://inaturalist-open-data.s3.amazonaws.com/taxa.csv.gz
curl -sS https://inaturalist-open-data.s3.amazonaws.com/observations.csv.gz | zcat \
  | python3 data-pipeline/filter_observations.py $WORK             # ~10 minutes, 13 GB streamed
python3 data-pipeline/aggregate_occurrence.py $WORK . 2026-08-27   # snapshot date shown on the site
python3 data-pipeline/fetch_geomodel.py $WORK .
curl -sS -o $WORK/ne_50m_land.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
python3 data-pipeline/build_ranges.py $WORK .                      # needs numpy and shapely
```

Then run `npm run build` and `npm run test:map` in `frontend/`.

## What each output means

- `frontend/public/data/occurrence/<collection>/<slug>.json`: square counts at 4°, 2°, 1°, 0.5°, 0.25° and 0.125°, each cell as `[x, y, records, people]` where `x = floor((lon + 180) / size)` and `y = floor((lat + 90) / size)`. `_all.json` combines every species to 0.25°. Records with stated accuracy over 60 km are skipped. Records over 14 km, which includes iNaturalist's obscured sensitive species, never appear in the 0.125° squares.
- `frontend/src/data/occurrence-summary.json`: totals, people and month counts per hemisphere for pages and the ID tool.
- `frontend/public/data/range/<collection>/<slug>.json`: the growing zone, a GeoJSON MultiPolygon clipped to land between 60°S and 84°N. It joins 1° areas where different people repeatedly verified the species with the Geomodel range. Some published Geomodel files do not match the verified records (fairy ring mushroom's model sits over Greenland and Antarctica), so a model is used only when at least 60% of verified records fall inside it, and only its parts within 8° of a record are kept. At the snapshot, 194 zones use both sources and 27 use records alone.
- `frontend/public/data/id-index/<collection>/`: 30° tiles of 1° cells listing which species were seen there (with people counts) and which are expected there. The ID tool loads one to four tiles for a location.
- `frontend/public/images/world-land.svg`: the land outline behind the library mini maps.

## Photographs for new entries

`collect_photo_candidates.py` streams the observation and photo exports again to list first photos of research-grade observations under CC0, CC BY or CC BY-SA. Candidates were reviewed on contact sheets and chosen by hand. Mushroom guides link the iNaturalist open-data image; herb photos are resized to WebP under `frontend/public/images/herbs/atlas/`. Every photo keeps its creator, license and observation link.
