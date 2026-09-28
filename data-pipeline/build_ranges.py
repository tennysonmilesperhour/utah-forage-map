"""Build each species' known growing zone and the identification lookup index.

Growing zone = 1-degree areas where different people have verified records
             + iNaturalist Geomodel expected range ("expected nearby"), when it agrees with those records,
             smoothed, clipped to land north of 60°S and simplified for the web.
Geomodel publishes species-rank models, so complexes use their namesake species. Some published
models do not match the verified records at all (for example polygons over Greenland and
Antarctica for fairy ring mushrooms), so a model is used only when at least 60% of verified
records fall inside it, and only its parts within 8 degrees of a verified record are kept.

Outputs:
  frontend/public/data/range/<collection>/<slug>.json    GeoJSON Feature per species
  frontend/public/data/id-index/<collection>/index.json  species order + tile list
  frontend/public/data/id-index/<collection>/<tx>_<ty>.json  30-degree tiles of 1-degree cells:
      s = [[species, observers], ...] seen in the cell, e = [species, ...] expected in the cell
  frontend/public/images/world-land.svg                   equirectangular land outline for mini maps
"""
import json, math, os, sys
import numpy as np
import shapely
from shapely.geometry import box, mapping, shape
from shapely.ops import unary_union

SCRATCH, ROOT = sys.argv[1], sys.argv[2]
catalogue = json.load(open(os.path.join(ROOT, 'data-pipeline', 'catalogue.json')))
occurrence_dir = os.path.join(ROOT, 'frontend', 'public', 'data', 'occurrence')
range_dir = os.path.join(ROOT, 'frontend', 'public', 'data', 'range')
index_dir = os.path.join(ROOT, 'frontend', 'public', 'data', 'id-index')
TILE = 30
MIN_MODEL_COVERAGE = 0.6
MODEL_REACH_DEGREES = 8

land = unary_union([shape(f['geometry']) for f in json.load(open(os.path.join(SCRATCH, 'ne_50m_land.geojson')))['features']]).buffer(0).intersection(box(-180, -60, 180, 84))
land_margin = land.buffer(0.3, quad_segs=2)
WORLD = box(-180, -60, 180, 84)
shapely.prepare(land_margin)

# One-degree cell centres for the lookup index.
xs, ys = np.meshgrid(np.arange(360), np.arange(180))
centres_x = (xs.ravel() - 180 + 0.5)
centres_y = (ys.ravel() - 90 + 0.5)
on_land = shapely.contains_xy(land_margin, centres_x, centres_y)


def one_degree_cells(slug, collection):
    payload = json.load(open(os.path.join(occurrence_dir, collection, f'{slug}.json')))
    level = next(level for level in payload['levels'] if level['res'] == 1)
    flat = level['cells']
    return payload, [(flat[i], flat[i + 1], flat[i + 2], flat[i + 3]) for i in range(0, len(flat), 4)]


def geomodel(model_id):
    path = os.path.join(SCRATCH, 'geomodel', f'{model_id}.geojson')
    if not os.path.exists(path):
        return None, None
    feature = json.load(open(path))
    return shape(feature['geometry']).buffer(0), feature['properties'].get('geomodel_version')


def build(collection):
    items = catalogue[collection]
    os.makedirs(os.path.join(range_dir, collection), exist_ok=True)
    seen = {}
    expected = {}
    report = []
    for index, item in enumerate(items):
        payload, cells = one_degree_cells(item['slug'], collection)
        model, version = geomodel(item.get('speciesTaxonId', item['taxonId']))
        observers_needed = 2 if payload['observers'] >= 40 else 1
        repeated = [box(x - 180, y - 90, x - 179, y - 89) for x, y, _, observers in cells if observers >= observers_needed]
        for x, y, _, observers in cells:
            seen.setdefault((x, y), []).append([index, observers])
        records_area = unary_union(repeated).buffer(0.9, quad_segs=2).buffer(-0.55, quad_segs=2) if repeated else None
        coverage = None
        model_used = False
        if model is not None and cells:
            shapely.prepare(model)
            weights = np.array([c[2] for c in cells], dtype=float)
            inside = shapely.intersects_xy(model.buffer(0.5), np.array([c[0] - 179.5 for c in cells]), np.array([c[1] - 89.5 for c in cells]))
            coverage = round(float(weights[inside].sum() / weights.sum()), 3)
            if coverage >= MIN_MODEL_COVERAGE:
                reach = unary_union([box(x - 180, y - 90, x - 179, y - 89) for x, y, _, _ in cells]).buffer(MODEL_REACH_DEGREES, quad_segs=2)
                model = model.buffer(0.2, quad_segs=2).buffer(-0.12, quad_segs=2).intersection(reach)
                model_used = not model.is_empty
        elif model is not None and not cells:
            model = model.buffer(0.2, quad_segs=2).buffer(-0.12, quad_segs=2)
            model_used = True
        parts = [part for part in (model if model_used else None, records_area) if part is not None]
        if not parts:
            report.append((item['slug'], 'no zone'))
            continue
        zone = unary_union(parts).intersection(land_margin).intersection(WORLD)
        zone = shapely.set_precision(zone.simplify(0.12, preserve_topology=True), 0.01).buffer(0)
        if zone.is_empty:
            report.append((item['slug'], 'empty zone'))
            continue
        if zone.geom_type == 'Polygon':
            zone = shapely.MultiPolygon([zone])
        elif zone.geom_type == 'GeometryCollection':
            zone = shapely.MultiPolygon([g for g in zone.geoms if g.geom_type == 'Polygon'])
        # Drop specks that are invisible at world scale and only add weight.
        zone = shapely.MultiPolygon([p for p in zone.geoms if p.area >= 0.08]) if len(zone.geoms) > 1 else zone
        sources = []
        if model_used:
            sources.append('geomodel')
        if records_area is not None:
            sources.append('records')
        feature = {
            'type': 'Feature',
            'properties': {
                'slug': item['slug'], 'modelTaxonId': item.get('speciesTaxonId', item['taxonId']) if model_used else None,
                'geomodelVersion': version if model_used else None, 'geomodelRecordCoverage': coverage, 'sources': sources,
                'repeatedRecordThreshold': observers_needed,
            },
            'geometry': mapping(zone),
        }
        with open(os.path.join(range_dir, collection, f"{item['slug']}.json"), 'w') as out:
            json.dump(feature, out, separators=(',', ':'))
        shapely.prepare(zone)
        inside = np.flatnonzero(shapely.intersects_xy(zone, centres_x, centres_y) & on_land)
        for flat_index in inside:
            expected.setdefault((int(xs.ravel()[flat_index]), int(ys.ravel()[flat_index])), []).append(index)
        report.append((item['slug'], f'coverage={coverage} sources={sources} polygons={len(zone.geoms)} bytes={len(json.dumps(feature, separators=(",", ":")))}'))

    os.makedirs(os.path.join(index_dir, collection), exist_ok=True)
    tiles = {}
    for key in set(seen) | set(expected):
        x, y = key
        tile = tiles.setdefault((x // TILE, y // TILE), {})
        entry = {}
        if key in seen:
            entry['s'] = seen[key]
        if key in expected:
            entry['e'] = expected[key]
        tile[f'{x}_{y}'] = entry
    for (tx, ty), cells in tiles.items():
        with open(os.path.join(index_dir, collection, f'{tx}_{ty}.json'), 'w') as out:
            json.dump({'tile': TILE, 'cells': cells}, out, separators=(',', ':'))
    with open(os.path.join(index_dir, collection, 'index.json'), 'w') as out:
        json.dump({'cell': 1, 'tile': TILE, 'species': [item['slug'] for item in items], 'tiles': sorted(f'{tx}_{ty}' for tx, ty in tiles)}, out, separators=(',', ':'))
    return report


def world_svg():
    world = shapely.set_precision(land.simplify(0.25, preserve_topology=True), 0.1)
    paths = []
    for polygon in getattr(world, 'geoms', [world]):
        if polygon.area < 0.5:
            continue
        for ring in [polygon.exterior, *polygon.interiors]:
            coords = list(ring.coords)
            paths.append('M' + 'L'.join(f'{x:g} {-y:g}' for x, y in coords) + 'Z')
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="-180 -84 360 144" preserveAspectRatio="none">'
           f'<path fill="#fff" fill-rule="evenodd" d="{"".join(paths)}"/></svg>')
    target = os.path.join(ROOT, 'frontend', 'public', 'images', 'world-land.svg')
    with open(target, 'w') as out:
        out.write(svg)
    return len(svg)


for collection in ('fungi', 'herbs'):
    for slug, note in build(collection):
        print(collection, slug, note)
print('world svg bytes', world_svg())
