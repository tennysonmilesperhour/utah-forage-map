"""Stream the iNaturalist open-data observation export (stdin) and keep research-grade
Fungi and Plantae rows as compact TSVs (obs_fungi.tsv.gz, obs_plants.tsv.gz) in the work
directory: taxon_id, lat, lon, yyyymm, observer_id, accuracy_m.

  curl -sS https://inaturalist-open-data.s3.amazonaws.com/observations.csv.gz | zcat \
    | python3 filter_observations.py WORK_DIR
"""
import gzip, sys, time
SP = sys.argv[1]
fungi, plants = set(), set()
with gzip.open(f'{SP}/taxa.csv.gz', 'rt') as fh:
    next(fh)
    for line in fh:
        tid, ancestry = line.split('\t', 2)[:2]
        parts = ancestry.split('/')
        if len(parts) > 1:
            if parts[1] == '47170': fungi.add(tid)
            elif parts[1] == '47126': plants.add(tid)
print('taxa', len(fungi), len(plants), file=sys.stderr, flush=True)
out_f = gzip.open(f'{SP}/obs_fungi.tsv.gz', 'wt', compresslevel=3)
out_p = gzip.open(f'{SP}/obs_plants.tsv.gz', 'wt', compresslevel=3)
start = time.time(); n = kept_f = kept_p = 0
stdin = sys.stdin
next(stdin)
for line in stdin:
    n += 1
    if n % 20000000 == 0:
        print(f'{n:,} rows {time.time()-start:.0f}s fungi={kept_f:,} plants={kept_p:,}', file=sys.stderr, flush=True)
    c = line.split('\t')
    if len(c) < 8 or c[6] != 'research' or not c[2] or not c[3]:
        continue
    tid = c[5]
    if tid in fungi: out, kept_f = out_f, kept_f + 1
    elif tid in plants: out, kept_p = out_p, kept_p + 1
    else: continue
    d = c[7]
    ym = d[:4] + d[5:7] if len(d) >= 7 else ''
    acc = c[4]
    out.write(f'{tid}\t{c[2][:9]}\t{c[3][:10]}\t{ym}\t{c[1]}\t{acc.split(".")[0] if acc else ""}\n')
out_f.close(); out_p.close()
print(f'DONE {n:,} rows {time.time()-start:.0f}s fungi={kept_f:,} plants={kept_p:,}', file=sys.stderr, flush=True)
