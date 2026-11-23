#!/usr/bin/env python3
"""
Compare a Python TTE tile (lib/tte_map.py, LAEA 30 m) with the GEE product
projects/foreststructure/TTE_DATA_v201902v2 downloaded as 1-degree tiles.

The Python output is resampled (nearest) onto each GEE tile's EPSG:4326 grid,
which is what the GEE download did to the LAEA asset, so pixels line up.

Usage:
  python validate_tte_vs_gee.py --tile_num 996,4082 --py_dir <dir with tte_*_NNNNNNN.tif> --outcsv out.csv
"""
import argparse
import glob
import os

import numpy as np
import pandas as pd
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject

REF_TINDEX = ('/home/jovyan/my-public-bucket/DPS_tile_lists/TTE/download_gee_tiles_v1/'
              'tte_montesano_2010_30m/TTE_tindex_master.csv')
BANDS = ['tte_domain', 'tte_zones', 'tte_abruptness', 'tte_classification', 'tcc']


def ref_path(tile_num, tindex=REF_TINDEX):
    ti = pd.read_csv(tindex)
    p = ti[ti.tile_num == int(tile_num)].local_path.values[-1]
    return p.replace('/projects/', '/home/jovyan/')


def to_ref_grid(py_fn, ref):
    out = {}
    with rasterio.open(py_fn) as src:
        for i, b in enumerate(BANDS, start=1):
            arr = np.full((ref.height, ref.width), np.nan, dtype=np.float32)
            reproject(rasterio.band(src, i), arr, src_nodata=np.nan, dst_transform=ref.transform,
                      dst_crs=ref.crs, dst_nodata=np.nan, resampling=Resampling.nearest)
            out[b] = arr
    return out


def compare(tile_num, py_fn):
    with rasterio.open(ref_path(tile_num)) as ref:
        r = {b: ref.read(i + 1).astype(np.float32) for i, b in enumerate(BANDS)}
        for b in r:
            r[b][~np.isfinite(r[b])] = np.nan
        p = to_ref_grid(py_fn, ref)

    # only compare inside the reference domain and where the python tile has coverage
    cov = np.isfinite(p['tte_domain']) | np.isfinite(r['tte_domain'])
    row = dict(tile_num=tile_num)
    d_r, d_p = np.isfinite(r['tte_domain']), np.isfinite(p['tte_domain'])
    row['domain_px_gee'] = int(d_r.sum())
    row['domain_agree'] = float((d_r == d_p)[cov].mean()) if cov.any() else np.nan

    cr, cp = r['tte_classification'], p['tte_classification']
    both = np.isfinite(cr) & np.isfinite(cp)
    either = np.isfinite(cr) | np.isfinite(cp)
    row['class_px_gee'] = int(np.isfinite(cr).sum())
    row['class_px_py'] = int(np.isfinite(cp).sum())
    row['class_mask_agree'] = float(both.sum() / either.sum()) if either.any() else np.nan
    row['class_agree'] = float((cr[both] == cp[both]).mean()) if both.any() else np.nan

    tb = np.isfinite(r['tcc']) & np.isfinite(p['tcc'])
    row['tcc_exact'] = float((r['tcc'][tb] == p['tcc'][tb]).mean()) if tb.any() else np.nan
    ab = np.isfinite(r['tte_abruptness']) & np.isfinite(p['tte_abruptness'])
    dif = np.abs(r['tte_abruptness'][ab] - p['tte_abruptness'][ab])
    row['abr_mae'] = float(dif.mean()) if ab.any() else np.nan
    row['abr_within_0.01'] = float((dif < 0.01).mean()) if ab.any() else np.nan

    # per-class pixel counts (area shares) for both
    for k in range(1, 12):
        row[f'gee_c{k}'] = int((cr == k).sum())
        row[f'py_c{k}'] = int((cp == k).sum())
    conf = pd.crosstab(pd.Series(cr[both].astype(int), name='gee'),
                       pd.Series(cp[both].astype(int), name='py'))
    return row, conf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--tile_num', required=True)
    ap.add_argument('--py_dir', required=True)
    ap.add_argument('--outcsv', default=None)
    a = ap.parse_args()
    rows = []
    for tn in [int(s) for s in a.tile_num.split(',') if s]:
        fns = sorted(glob.glob(os.path.join(a.py_dir, f'tte_*_{tn:07}.tif')))
        if not fns:
            print(f'no python tile for {tn}')
            continue
        row, conf = compare(tn, fns[-1])
        rows.append(row)
        print(f'\n=== tile {tn} ===')
        print({k: (round(v, 4) if isinstance(v, float) else v) for k, v in row.items() if not k[:4] in ('gee_', 'py_c')})
        print('confusion (rows GEE, cols Python), % of shared pixels:')
        print((100 * conf / conf.values.sum()).round(2).to_string())
    df = pd.DataFrame(rows)
    if a.outcsv:
        df.to_csv(a.outcsv, index=False)
    return df


if __name__ == '__main__':
    main()
