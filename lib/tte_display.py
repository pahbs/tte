"""
One display COG per TTE map (30 m, uint8), for the review map page (docs/tte_review_map.html).

A map of thousands of tiles is too slow to mosaic zoomed out (MAAP's gateway stops at 30 s), and the original c2010 GEE
tiles carry overviews made by averaging class numbers, so below about zoom 12 they draw blank or as the wrong class.
Here a map's tiles are joined on their own grid, without resampling. The overviews are samples (nearest): zoomed out they keep
the mix of classes, where the most common class would hide most of the patterns.

Values: 0 no data, 1-11 TTE class, 12 in the TTE domain but not classified.

    build_reference()                             the original c2010 GEE map (EPSG:4326, as downloaded)
    build_run(collection, tcc_label)              a published run (polar LAEA); run again as more tiles are published
    update_page(collection, tcc_label)            point the page at the newest build of the run
"""
import json
import multiprocessing
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.shutil import copy as rio_copy
from rasterio.transform import Affine
from rasterio.windows import Window

OUT_DIR = os.path.expanduser('~/my-private-bucket/dps_output/tte_overviews')     # TiTiler can read it
OUT_S3 = 's3://maap-ops-workspace/montesano/dps_output/tte_overviews'
BAND_DOMAIN, BAND_CLASS = 1, 4                        # in the tile COGs (TTE and GEE)
DOMAIN = 12                                          # in the TTE domain, not classified
REFERENCE_NAME = 'display_reference_c2010_gee_tte_data_v201902v2_nearest'


def run_name(collection, label):
    """Dated, so that a new build is never mixed with tiles of the old one kept by TiTiler or a browser."""
    return f'display_{collection}__{label}_{time.strftime("%Y%m%dT%H%M")}'.replace('/', '_')


def _read(path, window=None):
    with rasterio.open(path) as s:
        dom, cls = s.read([BAND_DOMAIN, BAND_CLASS], window=window)
    a = np.where(dom == 1, DOMAIN, 0).astype(np.uint8)
    ok = np.isfinite(cls)
    a[ok] = cls[ok].astype(np.uint8)
    return a


def _chunk(job):
    """One chunk of the grid, put together from the tiles that touch it. A class wins over 'not classified'."""
    r0, c0, h, w, tiles = job
    out = np.zeros((h, w), np.uint8)
    for path, r, c, th, tw in tiles:                 # tile's first row, column; height, width
        y0, y1, x0, x1 = max(r, r0), min(r + th, r0 + h), max(c, c0), min(c + tw, c0 + w)
        a = _read(path, Window(x0 - c, y0 - r, x1 - x0, y1 - y0))
        o = out[y0 - r0:y1 - r0, x0 - c0:x1 - c0]
        take = (o == 0) | ((o == DOMAIN) & (a > 0))
        o[take] = a[take]
    return r0, c0, out


def _grid(path):
    with rasterio.open(path) as s:
        return s.transform, s.width, s.height, s.crs


def build(paths, name, workers=6, chunk=4096, tmp=None, levels=11, out_dir=None):
    """Join tile COGs that share one grid into <name>.tif; returns its path. Tiles that cross 180 degrees east are wrapped."""
    t0 = time.time()
    pool = lambda n: ProcessPoolExecutor(n, mp_context=multiprocessing.get_context('spawn'))   # threads crashed GDAL here
    with pool(workers) as ex:
        info = list(ex.map(_grid, paths, chunksize=20))
    tr0, _, _, crs = info[0]
    res = tr0.a
    cols = [(t.c - tr0.c) / res for t, *_ in info]
    rows = [(tr0.f - t.f) / res for t, *_ in info]
    off = max(abs(v - round(v)) for v in cols + rows)
    assert off < 0.02 and all(abs(t.a - res) < res * 1e-6 for t, *_ in info), f'tiles are not on one grid ({off:.3f} px off)'
    cols, rows = [round(v) for v in cols], [round(v) for v in rows]
    wrap = round(360 / res) if crs.is_geographic else 0
    c0, r0 = min(cols), min(rows)
    if wrap:                                         # start at 180 W
        c0 = min(c0, int(np.floor((-180 - tr0.c) / res)))
    W = wrap if wrap else max(c + i[1] for c, i in zip(cols, info)) - c0
    H = max(r + i[2] for r, i in zip(rows, info)) - r0
    print(f'{name}: {len(paths)} tiles, {W} x {H}, grid read in {time.time() - t0:.0f}s', flush=True)
    work = tempfile.mkdtemp(prefix='tte_display_', dir=tmp)
    raw, cog = os.path.join(work, 'raw.tif'), os.path.join(work, f'{name}.tif')
    prof = dict(driver='GTiff', width=W, height=H, count=1, dtype='uint8', nodata=0, crs=crs, tiled=True, blockxsize=512,
                blockysize=512, compress='deflate', zlevel=1, bigtiff='YES', sparse_ok=True,
                transform=tr0 * Affine.translation(c0, r0))
    jobs = {}
    for path, r, c, (_, tw, th, _) in zip(paths, rows, cols, info):
        r, c = r - r0, c - c0
        for cc in ([c, c - wrap] if wrap else [c]):  # a tile across 180 degrees is used on both sides
            for i in range(max(r, 0) // chunk, (min(r + th, H) - 1) // chunk + 1):
                for j in range(max(cc, 0) // chunk, (min(cc + tw, W) - 1) // chunk + 1):
                    if cc + tw > 0 and cc < W:
                        jobs.setdefault((i, j), []).append((path, r, cc, th, tw))
    jobs = [(i * chunk, j * chunk, min(chunk, H - i * chunk), min(chunk, W - j * chunk), t) for (i, j), t in sorted(jobs.items())]
    # each block is written once; worker processes, a few chunks in flight at a time
    with rasterio.open(raw, 'w', **prof) as dst, pool(workers) as ex:
        for k in range(0, len(jobs), 8 * workers):
            for r, c, a in ex.map(_chunk, jobs[k:k + 8 * workers]):
                if a.any():
                    dst.write(a, 1, window=Window(c, r, a.shape[1], a.shape[0]))
            if (k // (8 * workers)) % 10 == 0:
                print(f'  {min(k + 8 * workers, len(jobs))}/{len(jobs)} chunks ({time.time() - t0:.0f}s)', flush=True)
    env = dict(GDAL_NUM_THREADS='6', COMPRESS_OVERVIEW='DEFLATE', BIGTIFF_OVERVIEW='YES', SPARSE_OK_OVERVIEW='TRUE',
               GDAL_TIFF_OVR_BLOCKSIZE='512', GDAL_CACHEMAX=1500)
    with rasterio.Env(**env), rasterio.open(raw, 'r+') as dst:
        f = [2 ** i for i in range(1, levels + 1) if max(W, H) / 2 ** i > 200]
        dst.build_overviews(f, Resampling.nearest)
        dst.update_tags(source_tiles=str(len(paths)), tile_nums=json.dumps(sorted(int(re.search(r'(\d+)\.tif$', p)[1]) for p in paths)),
                        built=time.strftime('%Y-%m-%d'), name=name)
    print(f'  overviews ({time.time() - t0:.0f}s)', flush=True)
    rio_copy(raw, cog, driver='COG', compress='deflate', blocksize=512, bigtiff='YES', overviews='FORCE_USE_EXISTING',
             sparse_ok=True, num_threads=6)
    out = os.path.join(out_dir or OUT_DIR, f'{name}.tif')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    shutil.copyfile(cog, out)
    print(f'  {out}: {os.path.getsize(cog) / 1e9:.2f} GB ({time.time() - t0:.0f}s)', flush=True)
    shutil.rmtree(work, ignore_errors=True)
    return out


def _build_alone(paths, name):
    """build() in a Python of its own: GDAL crashed on closing the file when pandas / pyarrow were loaded too."""
    with tempfile.NamedTemporaryFile('w', suffix='.txt', delete=False) as f:
        f.write('\n'.join(paths))
    subprocess.run([sys.executable, '-u', os.path.abspath(__file__), name, f.name], check=True)
    os.remove(f.name)


def build_reference():
    import pandas as pd
    import tte_overview as ov
    ti = pd.read_csv(ov.GEE_TINDEX).drop_duplicates('tile_num', keep='last')
    _build_alone([p.replace('/projects/', '/home/jovyan/') for p in ti.local_path], REFERENCE_NAME)


def build_run(collection, label):
    from pystac_client import Client
    import tte_overview as ov
    s = Client.open('https://dps-stac.maap-project.org').search(
        collections=[collection], filter_lang='cql2-json', limit=500,
        filter={'op': '=', 'args': [{'property': 'tte:tcc_label'}, label]})
    _build_alone([ov.mount_path(i.assets['tte'].href) for i in s.items()], run_name(collection, label))


def update_page(collection, label, page=None):
    """Write the maps' files, and how many of the run's domain tiles are in them, into docs/tte_review_map.html."""
    import glob
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    page = page or os.path.join(repo, 'docs', 'tte_review_map.html')
    newest = sorted(glob.glob(os.path.join(OUT_DIR, f'display_{collection}__{label}_2*.tif')))[-1]
    with rasterio.open(newest) as src:
        n, built = int(src.tags()['source_tiles']), src.tags()['built']
        have = set(json.loads(src.tags().get('tile_nums', '[]')))
    with open(os.path.join(repo, 'dps', 'tte_tiles_domain_pixels.csv')) as f:
        dom = {int(t) for t, px in (ln.split(',')[:2] for ln in f.read().split()[1:]) if float(px) > 0}
    n, total = (len(have & dom) if have else n), len(dom)
    maps = {'ref': {'url': f'{OUT_S3}/{REFERENCE_NAME}.tif', 'short': 'c. 2010',
                    'label': 'c. 2010: derived from boreal-calibrated tree cover (≥ 2 m tall) in N. America & Hansen 2010 tree cover in Eurasia'},
            'run': {'url': f'{OUT_S3}/{os.path.basename(newest)}', 'short': 'c. 2020',
                    'label': 'c. 2020: derived from tree cover computed from Meta canopy height (v2) estimates for pixels ≥ 2 m tall',
                    'progress': f'{n:,} of {total:,} tiles as of {built}', 'done': n >= total},
            'updated': time.strftime('%Y-%m-%d')}
    with open(page, encoding='utf-8') as f:
        html = f.read()
    html, k = re.subn(r'const MAPS = .*;', lambda m: 'const MAPS = ' + json.dumps(maps) + ';', html, count=1)
    assert k == 1, 'MAPS line not found'
    with open(page, 'w', encoding='utf-8') as f:
        f.write(html)
    print(page, maps['run']['progress'])


if __name__ == '__main__':                            # tte_display.py <name> <file listing the tiles> [folder]
    build([ln.strip() for ln in open(sys.argv[2]) if ln.strip()], sys.argv[1], out_dir=(sys.argv[3:] or [None])[0])
