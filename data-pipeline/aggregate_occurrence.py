"""Aggregate research-grade iNaturalist open-data observations into iNaturalist-style
grid squares for every catalogue species.

Inputs (produced by filter_observations.py):
  obs_fungi.tsv.gz / obs_plants.tsv.gz  rows: taxon_id, lat, lon, yyyymm, observer_id, accuracy
  taxa.csv.gz                           iNaturalist open-data taxonomy

Outputs (under frontend/public/data/occurrence/<collection>/):
  <slug>.json   per-species squares at several resolutions, observer counts and month totals
  _all.json     every catalogue species combined, used when no species is selected
and a small summary manifest at frontend/src/data/occurrence-summary.json.
"""
import gzip, json, math, os, sys
from collections import defaultdict

SCRATCH, ROOT = sys.argv[1], sys.argv[2]
LEVELS = [4, 2, 1, 0.5, 0.25, 0.125]
MAX_ACCURACY_M = 60000  # skip points whose stated uncertainty is wider than a 0.5-degree square
# iNaturalist obscures sensitive species inside a ~0.2-degree box, reported as ~20-30 km accuracy.
# Those records still count at 0.25 degrees and coarser, never in the finest squares.
FINEST_ACCURACY_M = 14000

catalogue = json.load(open(os.path.join(ROOT, 'data-pipeline', 'catalogue.json')))

ancestry = {}
with gzip.open(os.path.join(SCRATCH, 'taxa.csv.gz'), 'rt') as fh:
    next(fh)
    for line in fh:
        tid, anc = line.split('\t', 2)[:2]
        ancestry[tid] = anc.split('/') if anc else []


def owner_map(items):
    """Map every descendant taxon id to its nearest catalogue ancestor (the live map does the same)."""
    wanted = {str(item['taxonId']): index for index, item in enumerate(items)}
    owners = {}
    for tid, anc in ancestry.items():
        if tid in wanted:
            owners[tid] = wanted[tid]
            continue
        for ancestor in reversed(anc):
            if ancestor in wanted:
                owners[tid] = wanted[ancestor]
                break
    return owners


def cell(value, offset, res):
    return int(math.floor((value + offset) / res))


def build(collection, source):
    items = catalogue[collection]
    owners = owner_map(items)
    per = [dict(levels=[defaultdict(lambda: [0, set()]) for _ in LEVELS], observers=set(), total=0,
                north=[0] * 12, south=[0] * 12, first='999999', last='000000') for _ in items]
    combined = [defaultdict(lambda: [0, set()]) for _ in LEVELS[:5]]
    skipped = 0
    with gzip.open(os.path.join(SCRATCH, source), 'rt') as fh:
        for line in fh:
            tid, lat, lon, ym, observer, accuracy = line.rstrip('\n').split('\t')
            index = owners.get(tid)
            if index is None:
                continue
            accuracy = int(accuracy) if accuracy else 0
            if accuracy > MAX_ACCURACY_M:
                skipped += 1
                continue
            lat, lon = float(lat), float(lon)
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            record = per[index]
            record['total'] += 1
            record['observers'].add(observer)
            if len(ym) == 6:
                month = int(ym[4:]) - 1
                if 0 <= month < 12:
                    (record['north'] if lat >= 0 else record['south'])[month] += 1
                record['first'] = min(record['first'], ym)
                record['last'] = max(record['last'], ym)
            for level, res in enumerate(LEVELS):
                if res < 0.25 and accuracy > FINEST_ACCURACY_M:
                    continue
                key = (cell(lon, 180, res), cell(lat, 90, res))
                bucket = record['levels'][level][key]
                bucket[0] += 1
                bucket[1].add(observer)
                if level < len(combined):
                    shared = combined[level][key]
                    shared[0] += 1
                    shared[1].add(observer)
    out_dir = os.path.join(ROOT, 'frontend', 'public', 'data', 'occurrence', collection)
    os.makedirs(out_dir, exist_ok=True)
    summary = {}

    def encode(level_cells):
        flat = []
        for (x, y), (count, observers) in sorted(level_cells.items()):
            flat += [x, y, count, len(observers)]
        return flat

    for item, record in zip(items, per):
        payload = {
            'slug': item['slug'], 'taxonId': item['taxonId'], 'total': record['total'],
            'observers': len(record['observers']),
            'months': {'north': record['north'], 'south': record['south']},
            'firstYear': int(record['first'][:4]) if record['total'] and record['first'] != '999999' else None,
            'lastMonth': f"{record['last'][:4]}-{record['last'][4:]}" if record['last'] != '000000' else None,
            'levels': [{'res': res, 'cells': encode(record['levels'][level])} for level, res in enumerate(LEVELS)],
        }
        with open(os.path.join(out_dir, f"{item['slug']}.json"), 'w') as out:
            json.dump(payload, out, separators=(',', ':'))
        summary[item['slug']] = {
            'total': payload['total'], 'observers': payload['observers'], 'months': payload['months'],
            'firstYear': payload['firstYear'], 'lastMonth': payload['lastMonth'],
        }
    with open(os.path.join(out_dir, '_all.json'), 'w') as out:
        json.dump({'slug': '_all', 'levels': [{'res': res, 'cells': encode(combined[level])} for level, res in enumerate(LEVELS[:5])]}, out, separators=(',', ':'))
    print(collection, 'skipped for accuracy', skipped, file=sys.stderr)
    return summary


summary = {'source': 'iNaturalist open data (AWS Open Data Program), research-grade observations', 'snapshot': sys.argv[3] if len(sys.argv) > 3 else None,
           'levels': LEVELS, 'fungi': build('fungi', 'obs_fungi.tsv.gz'), 'herbs': build('herbs', 'obs_plants.tsv.gz')}
with open(os.path.join(ROOT, 'frontend', 'src', 'data', 'occurrence-summary.json'), 'w') as out:
    json.dump(summary, out, separators=(',', ':'))
