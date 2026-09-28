"""Download iNaturalist Geomodel expected-range polygons for each catalogue species.

Geomodel publishes species-rank models only. A catalogue entry that points at a
complex (for example the Urtica dioica complex) uses the species of the same name.
"""
import gzip, json, os, sys, urllib.request

SCRATCH, ROOT = sys.argv[1], sys.argv[2]
BASE = 'https://inaturalist-open-data.s3.amazonaws.com/geomodel/geojsons/latest/'
catalogue = json.load(open(os.path.join(ROOT, 'data-pipeline', 'catalogue.json')))
wanted = {item['latin'] for items in catalogue.values() for item in items}
species_ids = {}
with gzip.open(os.path.join(SCRATCH, 'taxa.csv.gz'), 'rt') as fh:
    next(fh)
    for line in fh:
        tid, _, _, rank, name, active = line.rstrip('\n').split('\t')
        if name in wanted and rank == 'species' and active == 'true':
            species_ids[name] = int(tid)
os.makedirs(os.path.join(SCRATCH, 'geomodel'), exist_ok=True)
mapping = {}
for collection, items in catalogue.items():
    for item in items:
        model_id = species_ids.get(item['latin'], item['taxonId'])
        target = os.path.join(SCRATCH, 'geomodel', f'{model_id}.geojson')
        status = 'cached'
        if not os.path.exists(target):
            try:
                with urllib.request.urlopen(f'{BASE}{model_id}.geojson', timeout=60) as response, open(target, 'wb') as out:
                    out.write(response.read())
                status = 'ok'
            except Exception as error:  # a missing model is recorded, not fatal
                status = f'missing ({error})'
        mapping[item['slug']] = {'modelTaxonId': model_id, 'status': status}
        print(collection, item['slug'], model_id, status)
json.dump(mapping, open(os.path.join(SCRATCH, 'geomodel', 'mapping.json'), 'w'), indent=1)
