"""Find openly licensed (CC0, CC BY, CC BY-SA) first photos of research-grade
observations for the given catalogue entries.

Pass 1 streams observations.csv.gz from stdin and keeps observation UUIDs for the wanted taxa.
Pass 2 (mode "photos") streams photos.csv.gz and keeps permissive first photos.
Candidates were then reviewed by eye on contact sheets before any photo was used.
"""
import gzip, json, os, sys

SCRATCH, ROOT, mode = sys.argv[1], sys.argv[2], sys.argv[3]
catalogue = json.load(open(os.path.join(ROOT, 'data-pipeline', 'catalogue.json')))
items = [dict(item, collection=collection) for collection, entries in catalogue.items() for item in entries if item.get('new')]

if mode == 'observations':
    wanted = {str(item['taxonId']): item['slug'] for item in items}
    owners = {}
    with gzip.open(os.path.join(SCRATCH, 'taxa.csv.gz'), 'rt') as fh:
        next(fh)
        for line in fh:
            tid, anc = line.split('\t', 2)[:2]
            if tid in wanted:
                owners[tid] = wanted[tid]
                continue
            for ancestor in reversed(anc.split('/')):
                if ancestor in wanted:
                    owners[tid] = wanted[ancestor]
                    break
    stdin = sys.stdin
    next(stdin)
    with open(os.path.join(SCRATCH, 'candidate_observations.tsv'), 'w') as out:
        for line in stdin:
            c = line.split('\t')
            if len(c) > 7 and c[6] == 'research' and c[5] in owners:
                out.write(f'{c[0]}\t{owners[c[5]]}\t{c[1]}\t{c[2]}\t{c[3]}\n')
elif mode == 'photos':
    observations = {}
    with open(os.path.join(SCRATCH, 'candidate_observations.tsv')) as fh:
        for line in fh:
            uuid, slug, observer, lat, lon = line.rstrip('\n').split('\t')
            observations[uuid] = slug
    permitted = {'CC0', 'CC-BY', 'CC-BY-SA'}
    stdin = sys.stdin
    next(stdin)
    with open(os.path.join(SCRATCH, 'candidate_photos.tsv'), 'w') as out:
        for line in stdin:
            c = line.rstrip('\n').split('\t')
            if len(c) < 9 or c[5] not in permitted or c[8] != '0':
                continue
            slug = observations.get(c[2])
            if slug:
                out.write(f'{slug}\t{c[1]}\t{c[2]}\t{c[3]}\t{c[4]}\t{c[5]}\t{c[6]}\t{c[7]}\n')
