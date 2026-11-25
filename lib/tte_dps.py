"""
Helpers for dps/DPS_tte_map.ipynb: what is left to run, cancel queued jobs, submit the rest.
Only cancel(..., confirm=True) and submit(..., confirm=True) change anything on DPS.

Every submitted job is logged in ~/tte_dps_submissions/<job tag>.csv (tile_num, job_id, submit_time).
"""
import datetime
import os
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import pandas as pd

STAC_API = 'https://dps-stac.maap-project.org'
LOG_DIR = os.path.expanduser('~/tte_dps_submissions')
QUEUED, RUNNING = {'accepted', 'queued'}, {'running'}
DONE, ENDED = {'successful'}, {'failed', 'dismissed'}      # final: never asked for again
GONE = 'gone'      # HTTP 404 'No job with that job ID found', 3 times: a cancelled queued job, purged from DPS


def _json(r):
    try:
        return r.json()
    except Exception:
        return {}


def log_file(tag):
    return os.path.join(LOG_DIR, f'{tag}.csv')


def read_log(tag):
    if not os.path.exists(log_file(tag)):
        return pd.DataFrame({'tile_num': pd.Series(dtype=int), 'job_id': pd.Series(dtype=str),
                             'submit_time': pd.Series(dtype=str)})
    return pd.read_csv(log_file(tag), dtype={'job_id': str})


def find_process(maap, algo, version):
    """Numeric processID of exactly this algorithm version."""
    procs = _json(maap.list_algorithms(algorithm_name=algo, algorithm_version=version))
    procs = procs.get('processes', []) if isinstance(procs, dict) else procs
    hits = [p for p in procs if p.get('id') == algo and p.get('version') == version]
    if len(hits) != 1:
        raise RuntimeError(f'{algo} {version}: expected one registered process, found {len(hits)}')
    return hits[0]['processID']


def published_tiles(collection, label):
    """Tiles of this run label in the DPS STAC catalog. Errors are raised: an unread catalog must not look empty."""
    from pystac_client import Client
    s = Client.open(STAC_API).search(collections=[collection], filter_lang='cql2-json', limit=500,
                                     filter={'op': '=', 'args': [{'property': 'tte:tcc_label'}, label]})
    return {int(i.properties['tte:tile_num']) for i in s.items()}


def job_statuses(maap, tag, workers=16):
    """The log with each job's status. Final statuses are kept in <tag>_final.csv and not asked for again."""
    log, cache_fn = read_log(tag), os.path.join(LOG_DIR, f'{tag}_final.csv')
    cache = {}
    if os.path.exists(cache_fn):
        c = pd.read_csv(cache_fn, dtype=str)
        cache = dict(zip(c.job_id, c.status))

    def ask(jid):
        n404 = 0
        for _ in range(3):
            try:
                r = maap.get_job_status(jid)
                st = str(_json(r).get('status') or '').lower()      # an error body carries its HTTP code here
            except Exception:
                continue
            if getattr(r, 'status_code', None) == 404:
                n404 += 1
            elif st and not st.isdigit():
                return st
        return GONE if n404 == 3 else 'unknown'

    need = [j for j in log.job_id if j not in cache]
    with ThreadPoolExecutor(workers) as ex:
        got = dict(zip(need, ex.map(ask, need)))
    final = {**cache, **{j: s for j, s in got.items() if s in DONE | ENDED}}
    if final:
        os.makedirs(LOG_DIR, exist_ok=True)
        pd.DataFrame(list(final.items()), columns=['job_id', 'status']).to_csv(cache_fn, index=False)
    log['status'] = [cache.get(j) or got[j] for j in log.job_id]
    return log


@dataclass
class Plan:
    tag: str
    tiles: pd.DataFrame        # tile_num, state: done / running / queued / unknown / to run
    jobs: pd.DataFrame         # the log with status
    n_log: int                 # log rows when the plan was made

    def to_run(self):
        return self.tiles.loc[self.tiles.state == 'to run', 'tile_num'].tolist()


def check(maap, tag, label, collection, tiles):
    """Read only: the state of each tile of `tiles` for this run. Nothing is submitted or cancelled."""
    pub = published_tiles(collection, label)
    jobs = job_statuses(maap, tag)
    by_tile = jobs.groupby('tile_num').status.agg(set).to_dict()

    def state(t):
        st = by_tile.get(t, set())
        if t in pub or st & DONE:
            return 'done'
        if st & RUNNING:
            return 'running'
        if st & QUEUED:
            return 'queued'
        return 'to run' if st <= ENDED | {GONE} else 'unknown'         # unknown statuses are never resubmitted

    df = pd.DataFrame({'tile_num': sorted({int(t) for t in tiles})})
    df['state'] = [state(t) for t in df.tile_num]
    n = df.state.value_counts()
    print(f'{label}: {len(df)} tiles (read only: NOTHING was submitted)')
    for k, txt in (('done', 'done'), ('running', 'running now'), ('queued', 'queued'),
                   ('unknown', 'status unknown: left alone'), ('to run', 'to run (step 5)')):
        print(f'  {n.get(k, 0):5d}  {txt}')
    q = jobs[jobs.status.isin(QUEUED)]
    if len(q):
        print('  queued jobs on any tile, by hour submitted:', q.submit_time.str[:13].value_counts().sort_index().to_dict())
    late = [t for t in df.loc[df.state == 'done', 'tile_num'] if t not in pub]
    if late:
        print(f'  ({len(late)} of the done tiles have a successful job but are not in the STAC catalog (yet))')
    return Plan(tag, df, jobs, len(jobs))


def cancel(maap, plan, submitted_before=None, confirm=False):
    """Ask DPS to cancel the queued jobs submitted before a time ('2026-11-24T12:00'), so that newer jobs are never
    touched. Running jobs finish. DPS queues one purge job per request and works through them slowly: ask ONCE,
    then re-run the check; asking again only adds more purge jobs."""
    if not submitted_before:
        print("NOTHING CANCELLED: give submitted_before, e.g. submitted_before='2026-11-24T12:00'.")
        return
    q = plan.jobs[plan.jobs.status.isin(QUEUED) & (plan.jobs.submit_time < submitted_before)]
    if not confirm:
        print(f'NOTHING CANCELLED: {len(q)} queued jobs would be. Set confirm=True to cancel them.')
        return
    def one(jid):
        try:
            return getattr(maap.cancel_job(jid), 'status_code', None)
        except Exception:
            return None
    with ThreadPoolExecutor(16) as ex:
        codes = pd.Series(list(ex.map(one, q.job_id)), dtype=object)
    ok = int(codes.isin([200, 202, 204]).sum())
    print(f'cancel requests: {ok} accepted, {len(q) - ok} refused. Accepted is not yet cancelled: re-run the check, do not ask again.')


def submit(maap, plan, process_id, params, queue, confirm=False, only=None):
    """Submit the plan's 'to run' tiles, one job each (only: a few of them). Logs each job as it is sent."""
    tiles = plan.to_run()
    if only is not None:
        tiles = [t for t in tiles if t in {int(x) for x in only}]
    again = set(read_log(plan.tag).tile_num.iloc[plan.n_log:].astype(int))      # sent since the plan was made
    tiles = [t for t in tiles if t not in again]
    if not confirm:
        print(f'NOTHING SUBMITTED: {len(tiles)} tiles would go to {queue}, tag {plan.tag}. Set confirm=True to submit.')
        return
    os.makedirs(LOG_DIR, exist_ok=True)
    sent, bad, run_bad = 0, [], 0
    for t in tiles:
        try:
            j = _json(maap.submit_job(process_id, inputs=dict(params, tile_num=str(t)), queue=queue, tag=plan.tag))
        except Exception as e:
            j = {'error': str(e)}
        jid = j.get('jobID') or j.get('id')
        if jid:
            fn = log_file(plan.tag)
            pd.DataFrame([[t, jid, datetime.datetime.now().isoformat(timespec='seconds')]],
                         columns=['tile_num', 'job_id', 'submit_time']).to_csv(fn, mode='a', index=False,
                                                                              header=not os.path.exists(fn))
            sent, run_bad = sent + 1, 0
        else:
            bad.append((t, str(j)[:150]))
            run_bad += 1
            if run_bad == 5:
                print('stopped after 5 refusals in a row')
                break
    print(f'SUBMITTED {sent} jobs to {queue}, tag {plan.tag}' + (f'; {len(bad)} refused, first: {bad[0]}' if bad else ''))
