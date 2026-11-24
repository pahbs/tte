"""
Continental overviews of TTE map runs, for review maps.

TiTiler (titiler-pgstac) mosaics a run's tiles on the fly, which is fine zoomed in but too slow for
thousands of tiles zoomed out (a map tile at zoom 3 needs every item under it; MAAP's gateway stops
at 30 s). An overview is one coarse COG per run (default 1 km, on the TTE map's north polar LAEA
grid), mosaicked once from the run's tiles. TiTiler draws a single COG quickly at any zoom, and it
can read COGs under dps_output, so overviews are written to
    ~/my-private-bucket/dps_output/tte_overviews/<name>.tif
    = s3://maap-ops-workspace/montesano/dps_output/tte_overviews/<name>.tif

Bands (uint8, nodata 255): 1 tte_domain (1), 2 tte_classification (1-11), 3 tcc (0-100 %).
Each tile is read from its internal overviews (nearest), so classes stay classes.

    build_run_overview(collection, tcc_label)    a published run (DPS STAC items)
    build_reference_overview()                    the original c2010 GEE map (download tiles)
"""
import os
import shutil
import tempfile
import time
import warnings

import numpy as np
import rasterio
import rasterio.errors
from rasterio.enums import Resampling
from rasterio.transform import Affine, from_origin
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import from_bounds

import tte_map as tm

RES = 1000                                                    # m
OVERVIEW_DIR = os.path.expanduser('~/my-private-bucket/dps_output/tte_overviews')
OVERVIEW_S3 = 's3://maap-ops-workspace/montesano/dps_output/tte_overviews'
NODATA = 255
BANDS = {'tte_domain': 1, 'tte_classification': 4, 'tcc': 5}   # band numbers in the tile COGs (TTE and GEE)
GEE_TINDEX = ('/home/jovyan/my-public-bucket/DPS_tile_lists/TTE/download_gee_tiles_v1/'
              'tte_montesano_2010_30m/TTE_tindex_master.csv')


def overview_name(collection, label):
    return f'{collection}__{label}'.replace('/', '_')


def overview_path(name):
    return os.path.join(OVERVIEW_DIR, f'{name}.tif')


def overview_s3(name):
    return f'{OVERVIEW_S3}/{name}.tif'


def grid(res=RES):
    """The TTE map's polar LAEA grid (same origin as the 30 m grid), coarsened to `res` metres."""
    n = int(np.ceil(2 * abs(tm.GRID_X0) / res))
    return from_origin(tm.GRID_X0, tm.GRID_Y0, res, res), (n, n)


def mount_path(href):
    """s3:// href in your MAAP buckets -> Hub mount path (fast); otherwise the href for GDAL."""
    for s3, mount in (('s3://maap-ops-workspace/montesano/', '/home/jovyan/my-private-bucket/'),
                      ('s3://maap-ops-workspace/shared/montesano/', '/home/jovyan/my-public-bucket/')):
        if href.startswith(s3) and os.path.exists(mount):
            return mount + href[len(s3):]
    return tm.as_gdal_path(href)


def _warp_tile(p, res, transform, shape):
    """One tile's bands warped into its window of the overview grid: (r0, c0, {band: float32 array}) or None."""
    warnings.filterwarnings('ignore', category=rasterio.errors.NotGeoreferencedWarning)
    with rasterio.Env(**tm.GDAL_ENV), rasterio.open(p) as src:
        # decimate to about the overview resolution (GDAL uses the file's internal overviews)
        px_m = abs(src.res[0]) * (111320 if src.crs.is_geographic else 1)
        f = max(1, int(res / px_m / 2))                      # keep ~2 source px per overview px
        h, w = max(1, src.height // f), max(1, src.width // f)
        st = src.transform * Affine.scale(src.width / w, src.height / h)
        win = from_bounds(*transform_bounds(src.crs, tm.LAEA_CRS, *src.bounds, densify_pts=21), transform)
        r0 = max(int(np.floor(win.row_off)) - 1, 0)
        c0 = max(int(np.floor(win.col_off)) - 1, 0)
        r1 = min(int(np.ceil(win.row_off + win.height)) + 1, shape[0])
        c1 = min(int(np.ceil(win.col_off + win.width)) + 1, shape[1])
        if r1 <= r0 or c1 <= c0:
            return None
        wt = transform * Affine.translation(c0, r0)
        a = src.read(list(BANDS.values()), out_shape=(len(BANDS), h, w),
                     resampling=Resampling.nearest).astype(np.float32)
        a[~np.isfinite(a)] = np.nan
        got = {}
        for i, b in enumerate(BANDS):
            tmp = np.full((r1 - r0, c1 - c0), np.nan, np.float32)
            reproject(a[i], tmp, src_transform=st, src_crs=src.crs, src_nodata=np.nan,
                      dst_transform=wt, dst_crs=tm.LAEA_CRS, dst_nodata=np.nan, resampling=Resampling.nearest)
            got[b] = tmp
        return r0, c0, got


def build(paths, name, res=RES, progress=200, workers=12):
    """Mosaic tile COGs (any CRS, bands as BANDS) into one overview COG; returns its s3 URL.
    Tiles are read in parallel (`workers` threads); where tiles overlap, the first one listed wins."""
    from concurrent.futures import ThreadPoolExecutor
    transform, shape = grid(res)
    out = {b: np.full(shape, NODATA, np.uint8) for b in BANDS}
    t0, n_ok = time.time(), 0

    def work(p):
        try:
            return _warp_tile(p, res, transform, shape)
        except Exception as e:
            print('  skipped', p, str(e)[:120])
            return 'error'

    with ThreadPoolExecutor(workers) as ex:
        for i, res_i in enumerate(ex.map(work, paths)):       # results in input order
            if res_i not in (None, 'error'):
                r0, c0, got = res_i
                for b, tmp in got.items():
                    sub = out[b][r0:r0 + tmp.shape[0], c0:c0 + tmp.shape[1]]
                    fill = (sub == NODATA) & np.isfinite(tmp)
                    sub[fill] = np.clip(np.round(tmp[fill]), 0, 254).astype(np.uint8)
                n_ok += 1
            if progress and (i + 1) % progress == 0:
                print(f'  {i + 1}/{len(paths)} tiles ({time.time() - t0:.0f}s)')
    # crop to the data, keep the polar grid alignment
    rows = np.where((out['tte_domain'] != NODATA).any(axis=1))[0]
    cols = np.where((out['tte_domain'] != NODATA).any(axis=0))[0]
    if not len(rows):
        raise RuntimeError(f'{name}: no data in {len(paths)} tiles')
    r0, r1, c0, c1 = rows[0], rows[-1] + 1, cols[0], cols[-1] + 1
    sub_t = transform * Affine.translation(c0, r0)
    tmpdir = tempfile.mkdtemp(prefix='tte_ov_')
    tmp_tif, cog = os.path.join(tmpdir, 'tmp.tif'), os.path.join(tmpdir, f'{name}.tif')
    prof = dict(driver='GTiff', height=r1 - r0, width=c1 - c0, count=len(BANDS), dtype='uint8', crs=tm.LAEA_CRS,
                transform=sub_t, nodata=NODATA, tiled=True, blockxsize=512, blockysize=512, compress='deflate')
    with rasterio.open(tmp_tif, 'w', **prof) as dst:
        for i, b in enumerate(BANDS, start=1):
            dst.write(out[b][r0:r1, c0:c1], i)
            dst.set_band_description(i, b)
        dst.update_tags(source_tiles=str(n_ok), resolution_m=str(res), name=name)
    from rasterio.shutil import copy as rio_copy
    rio_copy(tmp_tif, cog, driver='COG', compress='deflate', overview_resampling='nearest', blocksize=512)
    os.makedirs(OVERVIEW_DIR, exist_ok=True)
    shutil.copyfile(cog, overview_path(name))
    shutil.rmtree(tmpdir, ignore_errors=True)
    print(f'{name}: {n_ok} tiles -> {overview_path(name)} ({time.time() - t0:.0f}s)')
    return overview_s3(name)


def build_run_overview(collection, tcc_label, res=RES):
    """Overview of a published run: every STAC item of `collection` with tte:tcc_label == tcc_label."""
    from pystac_client import Client
    search = Client.open('https://dps-stac.maap-project.org').search(
        collections=[collection], filter_lang='cql2-json',
        filter={'op': '=', 'args': [{'property': 'tte:tcc_label'}, tcc_label]})
    paths = [mount_path(it.assets['tte'].href) for it in search.items()]
    print(f'{collection} / {tcc_label}: {len(paths)} tiles')
    return build(paths, overview_name(collection, tcc_label), res)


REFERENCE_NAME = 'reference_c2010_gee_tte_data_v201902v2'


def build_reference_overview(res=RES):
    """Overview of the original c2010 map from its GEE download tiles (the tile index; no STAC needed)."""
    import pandas as pd
    ti = pd.read_csv(GEE_TINDEX).drop_duplicates('tile_num', keep='last')
    paths = [p.replace('/projects/', '/home/jovyan/') for p in ti.local_path]
    print(f'reference c2010: {len(paths)} tiles')
    return build(paths, REFERENCE_NAME, res)
