#!/usr/bin/env python3
"""
Taiga-tundra ecotone (TTE) forest structure pattern map, without Earth Engine.

Reproduces the GEE workflow that made projects/foreststructure/TTE_DATA_v201902v2
(script `TTE _map_working` and `get_abruptness` in mod_forest_structure.js, repo
users/paulmontesano; copies in gee/ of github.com/pahbs/tte), described in

    Montesano et al. 2020, The bioclimatic extent and pattern of the cold edge of
    the boreal forest: the circumpolar taiga-tundra ecotone. ERL 15:105019.
    https://doi.org/10.1088/1748-9326/abb2c7

and lets any tree canopy cover (TCC) raster be used as input.

Steps, per 1-degree tile of tte_tiles.gpkg:
  1. Work on the original grid: north polar Lambert azimuthal equal area, 30 m,
     aligned to the TTE_DATA asset (inherited from Feng et al. TCC).
  2. TCC inside the TTE domain (bioclimatic envelope x ecoregions x land).
  3. Water (GSW occurrence >= 1) set to TCC 0, inside or outside the domain, so
     forest next to water gets an abrupt edge.
  4. Spatial rate of change of TCC = slope (degrees, 4-neighbour gradient, as
     ee.Terrain.slope) rescaled 0-90 -> 0-100.
  5. Abruptness = (rate - tcc) / (rate + tcc)  (normalized difference).
  6. Keep domain pixels with abruptness != 0 (drops large TCC=0 areas).
  7. Zones by TCC (sparse <=5, open 6-30, >30) and 11 classes from zone x abruptness.

Bands written (same names as the GEE asset): tte_domain, tte_zones,
tte_abruptness, tte_classification, tcc.
"""

import argparse
import os
import sys
import time

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import Affine
from rasterio.warp import reproject, transform as warp_transform

# ---------------------------------------------------------------------------
# Constants from the GEE workflow
# ---------------------------------------------------------------------------
LAEA_CRS = CRS.from_proj4("+proj=laea +lat_0=90 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs")
GRID_RES = 30.0
GRID_X0 = -4889349.355797417   # origin of projects/foreststructure/TTE_DATA_v201902v2
GRID_Y0 = 4889344.677898709

SPARSE_MAX = 5      # Zone 1: 0 < TCC <= 5
OPEN_MAX = 30       # Zone 2: 5 < TCC <= 30 ; Zone 3: TCC > 30 ('maxTCC' in GEE)
RELERR_MAX = 50     # Zone 3 vs 4 split (only if a TCC error layer is given)
WATER_OCC_MIN = 1   # GSW occurrence >= 1 -> water

CLASS_NAMES = {
    1: 'Sparse & Uniform',
    2: 'Sparse & Diffuse-gradual',
    3: 'Sparse & Diffuse-rapid',
    4: 'Sparse & Abrupt',
    5: 'Open & Uniform',
    6: 'Open & Diffuse-gradual',
    7: 'Open & Diffuse-rapid',
    8: 'Open & Abrupt',
    9: 'Intermediate & Closed',
    10: 'Non-forest edge (dry)',
    11: 'Non-forest edge (wet)',
}
CLASS_COLORS = ['#5255a3', '#1796a3', '#fdbf6f', '#ff7f00',
                '#ffffbf', '#d9ef8b', '#91cf60', '#1a9850',
                '#c4c4c4', '#ff0000', '#0000ff']
BAND_NAMES = ['tte_domain', 'tte_zones', 'tte_abruptness', 'tte_classification', 'tcc']

# Public inputs (same versions as the GEE assets used in v201902v2)
HANSEN_URL = ('https://storage.googleapis.com/earthenginepartners-hansen/'
              '{ver}/Hansen_{ver}_{layer}_{lat}_{lon}.tif')
HANSEN_VERSION = 'GFC-2018-v1.6'          # UMD/hansen/global_forest_change_2018_v1_6
GSW_URL = {
    '1.0': 'https://storage.googleapis.com/global-surface-water/downloads/occurrence/occurrence_{lon}_{lat}.tif',
    '1.4': 'https://storage.googleapis.com/global-surface-water/downloads2021/occurrence/occurrence_{lon}_{lat}v1_4_2021.tif',
}
GSW_VERSION = '1.0'                       # JRC/GSW1_0/GlobalSurfaceWater
META_CHM_VERSION = 'v2'                   # Meta/WRI canopy height map version for tcc_source='meta_chm'
META_HT_MIN = 2                           # m: canopy height counted as tree cover for tcc_source='meta_chm'

TILES_GPKG = 's3://maap-ops-workspace/shared/montesano/databank/tte_tiles.gpkg'
DOMAIN_VRT = 's3://maap-ops-workspace/shared/montesano/tte/static/tte_domain_v201902v2.vrt'

GDAL_ENV = dict(
    GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR',
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif,.TIF,.tiff,.vrt',
    GDAL_HTTP_MAX_RETRY='5',
    GDAL_HTTP_RETRY_DELAY='3',
    VSI_CACHE='TRUE',
    GDAL_CACHEMAX=1024,
)


# ---------------------------------------------------------------------------
# Grid helpers
# ---------------------------------------------------------------------------
def laea_grid_for_bounds(bounds_4326, buffer_px=5):
    """LAEA 30 m grid (aligned to the GEE asset) covering a lon/lat box plus a buffer."""
    w, s, e, n = bounds_4326
    lons = np.concatenate([np.linspace(w, e, 101), np.full(101, e), np.linspace(e, w, 101), np.full(101, w)])
    lats = np.concatenate([np.full(101, s), np.linspace(s, n, 101), np.full(101, n), np.linspace(n, s, 101)])
    xs, ys = warp_transform('EPSG:4326', LAEA_CRS, lons, lats)
    xs, ys = np.asarray(xs), np.asarray(ys)
    col0 = int(np.floor((xs.min() - GRID_X0) / GRID_RES)) - buffer_px
    col1 = int(np.ceil((xs.max() - GRID_X0) / GRID_RES)) + buffer_px
    row0 = int(np.floor((GRID_Y0 - ys.max()) / GRID_RES)) - buffer_px
    row1 = int(np.ceil((GRID_Y0 - ys.min()) / GRID_RES)) + buffer_px
    transform = Affine(GRID_RES, 0, GRID_X0 + col0 * GRID_RES, 0, -GRID_RES, GRID_Y0 - row0 * GRID_RES)
    return transform, (row1 - row0, col1 - col0)


def grid_lonlat_extent(transform, shape, n=100):
    """lon/lat of an n x n sample of points (edges included) over a LAEA grid."""
    h, w = shape
    rr, cc = np.meshgrid(np.linspace(0, h, n), np.linspace(0, w, n), indexing='ij')
    xs, ys = transform * (cc.ravel(), rr.ravel())
    lons, lats = warp_transform(LAEA_CRS, 'EPSG:4326', xs, ys)
    return np.asarray(lons), np.asarray(lats)


def lonlat_boxes(transform, shape, pad=0.05):
    """lon/lat bounding boxes of a LAEA grid; two boxes if it crosses the antimeridian."""
    lons, lats = grid_lonlat_extent(transform, shape)
    if lons.max() - lons.min() > 180:
        groups = [lons < 0, lons >= 0]
    else:
        groups = [np.ones(lons.shape, bool)]
    return [(lons[g].min() - pad, lats[g].min() - pad, lons[g].max() + pad, lats[g].max() + pad)
            for g in groups if g.any()]


def tiles_10deg(lons, lats):
    """(top lat, left lon) of the 10x10 degree tiles touched by points."""
    keys = set()
    for lon, lat in zip(lons, lats):
        top = int(np.floor(lat / 10.0) * 10 + 10)
        left = int(np.floor(lon / 10.0) * 10)
        left = -180 if left >= 180 else left
        keys.add((top, left))
    return sorted(keys)


def _fmt_lat(top, pad):
    return f"{abs(top):0{pad}d}{'N' if top >= 0 else 'S'}"


def _fmt_lon(left, pad):
    return f"{abs(left):0{pad}d}{'E' if left >= 0 else 'W'}"


def hansen_urls(keys, layer, version=HANSEN_VERSION):
    return [HANSEN_URL.format(ver=version, layer=layer, lat=_fmt_lat(t, 2), lon=_fmt_lon(l, 3)) for t, l in keys]


def gsw_urls(keys, version=GSW_VERSION):
    return [GSW_URL[version].format(lat=_fmt_lat(t, 1), lon=_fmt_lon(l, 1)) for t, l in keys]


def as_gdal_path(p):
    if p.startswith('s3://'):
        return '/vsis3/' + p[5:]
    if p.startswith('http://') or p.startswith('https://'):
        return '/vsicurl/' + p
    return p


def _window_for_box(src, box):
    """Pixel window (row0, row1, col0, col1) of a geographic raster covering a lon/lat box, or None."""
    w, s, e, n = box
    l, b, r, t = src.bounds
    w, s, e, n = max(w, l), max(s, b), min(e, r), min(n, t)
    if e <= w or n <= s:
        return None
    rx, ry = src.res
    c0, c1 = int(np.floor((w - l) / rx)), int(np.ceil((e - l) / rx))
    r0, r1 = int(np.floor((t - n) / ry)), int(np.ceil((t - s) / ry))
    return max(r0, 0), min(r1, src.height), max(c0, 0), min(c1, src.width)


def _warp_array(a, src_transform, src_crs, transform, shape, resampling=Resampling.nearest):
    tmp = np.full(shape, np.nan, dtype=np.float32)
    reproject(a.astype(np.float32), tmp, src_transform=src_transform, src_crs=src_crs, src_nodata=np.nan,
              dst_transform=transform, dst_crs=LAEA_CRS, dst_nodata=np.nan, resampling=resampling)
    return tmp


def _read_geographic(src, band, boxes, transform, shape, nod, resampling, src_crs=None):
    """Windowed read of a lon/lat raster for each box, warped into the grid (avoids whole-globe
    source windows when the grid crosses the antimeridian)."""
    out = np.full(shape, np.nan, dtype=np.float32)
    for box in boxes:
        win = _window_for_box(src, box)
        if win is None:
            continue
        r0, r1, c0, c1 = win
        a = src.read(band, window=((r0, r1), (c0, c1))).astype(np.float32)
        if nod is not None and np.isfinite(nod):
            a[a == nod] = np.nan
        a[~np.isfinite(a)] = np.nan
        st = src.transform * Affine.translation(c0, r0)
        tmp = _warp_array(a, st, src_crs or src.crs, transform, shape, resampling)
        fill = np.isnan(out) & ~np.isnan(tmp)
        out[fill] = tmp[fill]
    return out


def read_to_grid(paths, transform, shape, band=1, resampling=Resampling.nearest, src_nodata=None):
    """Warp one band of one or more rasters into the LAEA grid. Returns float32, NaN = no data."""
    out = np.full(shape, np.nan, dtype=np.float32)
    boxes = lonlat_boxes(transform, shape)
    for p in paths:
        try:
            with rasterio.open(as_gdal_path(p)) as src:
                nod = src_nodata if src_nodata is not None else src.nodata
                if src.crs is not None and src.crs.is_geographic:
                    tmp = _read_geographic(src, band, boxes, transform, shape, nod, resampling)
                else:
                    tmp = np.full(shape, np.nan, dtype=np.float32)
                    reproject(rasterio.band(src, band), tmp, src_nodata=nod,
                              dst_transform=transform, dst_crs=LAEA_CRS, dst_nodata=np.nan,
                              resampling=resampling)
        except rasterio.errors.RasterioIOError as e:
            print(f'  WARNING could not read {p}: {e}')
            continue
        fill = np.isnan(out) & ~np.isnan(tmp)
        out[fill] = tmp[fill]
    return out


# ---------------------------------------------------------------------------
# GEE pyramid emulation
#
# When GEE reprojected Hansen and GSW (0.00025 deg) to the 30 m LAEA grid it did
# not read full-resolution pixels everywhere: it read pyramid level 1 (2x2 blocks)
# north of ~64.07 N, where a 0.00025 deg pixel is < ~12 m wide.  Found by
# comparing GEE computePixels chips with the public files (Nov 2026):
#   treecover2000: level-1 = mean of 2x2, rounded half up      (99.7-100% match)
#   lossyear:      level-1 = top-left pixel of 2x2 ('sample')  (99.9%)
#   GSW occurrence: level-1 water if any of the 2x2 is water   (98-99.6%)
#   switch latitude: between 64.05 and 64.10 N at 66.5E, 150.5E, -100.5E
# Remaining 1-5% pixel differences are GEE's own nearest-neighbour sampling.
# ---------------------------------------------------------------------------
GEE_L1_LAT = 64.075


def _reduce2(a, how):
    h, w = (a.shape[0] // 2) * 2, (a.shape[1] // 2) * 2
    b = a[:h, :w].reshape(h // 2, 2, w // 2, 2)
    if how == 'mean_round':
        with np.errstate(invalid='ignore'):
            return np.floor(np.nanmean(b, axis=(1, 3)) + 0.5)
    if how == 'sample':
        return b[:, 0, :, 0]
    if how == 'any_water':
        wat = (b >= 1) & (b <= 100)
        out = np.where(wat, b, 0).max(axis=(1, 3)).astype(np.float64)
        out[np.isnan(b).all(axis=(1, 3))] = np.nan
        return out
    raise ValueError(how)


def pixel_lat(transform, shape, step=16):
    """Latitude of pixel centres (computed every `step` px, nearest upsampled)."""
    h, w = shape
    rr, cc = np.mgrid[0:h:step, 0:w:step]
    xs, ys = transform * (cc + 0.5, rr + 0.5)
    _, lat = warp_transform(LAEA_CRS, 'EPSG:4326', xs.ravel(), ys.ravel())
    lat = np.asarray(lat).reshape(rr.shape)
    return np.repeat(np.repeat(lat, step, 0), step, 1)[:h, :w]


def read_tiles_gee(urls, transform, shape, how, src_nodata=None, l1_lat=GEE_L1_LAT, pad_deg=0.05):
    """Read 0.00025-deg tiles into the LAEA grid the way GEE did (see above)."""
    boxes = lonlat_boxes(transform, shape, pad=pad_deg)
    lat_px = pixel_lat(transform, shape)
    need_l1, need_l0 = (lat_px >= l1_lat).any(), (lat_px < l1_lat).any()
    out = {0: np.full(shape, np.nan, np.float32), 1: np.full(shape, np.nan, np.float32)}
    for p in urls:
        try:
            src = rasterio.open(as_gdal_path(p))
        except rasterio.errors.RasterioIOError as e:
            print(f'  WARNING could not read {p}: {e}')
            continue
        with src:
            rx, ry = src.res
            nod = src_nodata if src_nodata is not None else src.nodata
            for box in boxes:
                win = _window_for_box(src, box)
                if win is None:
                    continue
                r0, r1, c0, c1 = win
                # even offsets so 2x2 blocks line up with the global 0.0005 deg pyramid grid
                r0, c0 = r0 - r0 % 2, c0 - c0 % 2
                r1, c1 = min(src.height, r1 + r1 % 2), min(src.width, c1 + c1 % 2)
                a = src.read(1, window=((r0, r1), (c0, c1))).astype(np.float64)
                if nod is not None:
                    a[a == nod] = np.nan
                for L, needed in ((0, need_l0), (1, need_l1)):
                    if not needed:
                        continue
                    if L == 0:
                        arr = a
                        if how == 'any_water':
                            arr = np.where((a >= 1) & (a <= 100), a, np.where(np.isnan(a), np.nan, 0))
                    else:
                        arr = _reduce2(a, how)
                    f = 2 ** L
                    st = Affine(rx * f, 0, src.bounds.left + c0 * rx, 0, -ry * f, src.bounds.top - r0 * ry)
                    tmp = _warp_array(arr, st, src.crs, transform, shape)
                    fill = np.isnan(out[L]) & ~np.isnan(tmp)
                    out[L][fill] = tmp[fill]
    return np.where(lat_px >= l1_lat, out[1], out[0]).astype(np.float32)


# ---------------------------------------------------------------------------
# Inputs
# ---------------------------------------------------------------------------
def tcc_hansen(transform, shape, year=2010, version=HANSEN_VERSION, emulate_gee=True):
    """Hansen treecover2000 with loss before `year` set to 0 (GEE: tcc_han_2010)."""
    keys = tiles_10deg(*grid_lonlat_extent(transform, shape))
    if emulate_gee:
        tc = read_tiles_gee(hansen_urls(keys, 'treecover2000', version), transform, shape, 'mean_round')
        ly = read_tiles_gee(hansen_urls(keys, 'lossyear', version), transform, shape, 'sample')
    else:
        tc = read_to_grid(hansen_urls(keys, 'treecover2000', version), transform, shape)
        ly = read_to_grid(hansen_urls(keys, 'lossyear', version), transform, shape)
    loss = (ly > 0) & (ly < (year - 2000))
    # GEE: tcc2000.not().updateMask(loss).unmask(tcc2000) -> loss pixels become (tcc2000 == 0)
    tc[loss] = (tc[loss] == 0).astype(np.float32)
    return tc


def tcc_from_path(paths, transform, shape, band=1, scale=1.0, valid_min=0, valid_max=100,
                  resampling=Resampling.nearest):
    tc = read_to_grid(paths, transform, shape, band=band, resampling=resampling) * scale
    tc[(tc < valid_min) | (tc > valid_max)] = np.nan
    return tc


def water_gsw(transform, shape, version=GSW_VERSION, emulate_gee=True):
    """GSW occurrence (0-100). 0 = never water, NaN = no data."""
    keys = tiles_10deg(*grid_lonlat_extent(transform, shape))
    if emulate_gee:
        return read_tiles_gee(gsw_urls(keys, version), transform, shape, 'any_water', src_nodata=255)
    return read_to_grid(gsw_urls(keys, version), transform, shape, src_nodata=255)


def domain_from_path(path, transform, shape):
    """Static TTE domain (1 = in domain) in the grid."""
    d = read_to_grid([path], transform, shape)
    boxes = [b for b in lonlat_boxes(transform, shape) if b[0] < -179]
    if boxes:
        # The GEE download wrote the tiles at -180..-179 with lon 180..181: read those with wrapped longitudes
        wrap = CRS.from_proj4('+proj=longlat +datum=WGS84 +lon_wrap=180 +no_defs')
        shifted = [(w + 360, s, e + 360, n) for w, s, e, n in boxes]
        with rasterio.open(as_gdal_path(path)) as src:
            if src.crs is not None and src.crs.is_geographic:
                tmp = _read_geographic(src, 1, shifted, transform, shape, src.nodata, Resampling.nearest, src_crs=wrap)
                fill = np.isnan(d) & ~np.isnan(tmp)
                d[fill] = tmp[fill]
    return d == 1


# ---------------------------------------------------------------------------
# Core TTE logic
# ---------------------------------------------------------------------------
def slope_deg_4n(z, res=GRID_RES):
    """Slope in degrees from 4-connected central differences (ee.Terrain.slope).
    NaN where the pixel or any of its 4 neighbours is NaN."""
    z = z.astype(np.float64)
    out = np.full(z.shape, np.nan)
    c = z[1:-1, 1:-1]
    dzdx = (z[1:-1, 2:] - z[1:-1, :-2]) / (2 * res)
    dzdy = (z[:-2, 1:-1] - z[2:, 1:-1]) / (2 * res)
    s = np.degrees(np.arctan(np.sqrt(dzdx ** 2 + dzdy ** 2)))
    s[np.isnan(c)] = np.nan
    out[1:-1, 1:-1] = s
    return out


def abruptness(tcc, res=GRID_RES):
    """GEE get_abruptness: returns (spat_rate_of_change 0-100, abruptness -1..1)."""
    rate = slope_deg_4n(tcc, res) / 90.0 * 100.0
    t = tcc.astype(np.float64)
    den = rate + t
    with np.errstate(invalid='ignore', divide='ignore'):
        nd = np.where(den == 0, 0.0, (rate - t) / den)   # normalizedDifference: 0 when both are 0
    nd[np.isnan(rate) | np.isnan(t)] = np.nan
    return rate.astype(np.float32), nd.astype(np.float32)


def classify(tcc, domain, water_occ, tcc_relerr=None, res=GRID_RES):
    """Run the TTE workflow on co-registered arrays. Returns dict of output bands (NaN = no data)."""
    water = np.nan_to_num(water_occ, nan=0) >= WATER_OCC_MIN

    # tcc_data = tte_domain.where(realm, tcc): TCC inside the domain only
    tcc_d = np.where(domain, tcc, np.nan).astype(np.float32)
    # tcc_data.unmask(water).where(water, 0): water is TCC 0, inside or outside the domain
    tcc_d[water] = 0

    rate, abr = abruptness(tcc_d, res)

    # mask to domain, then mask_abrupt: tcc >= 0 and |abruptness| > 0
    valid = domain & ~np.isnan(tcc_d) & ~np.isnan(abr)
    keep = valid & (tcc_d >= 0) & (np.abs(abr) > 0)

    t = tcc_d
    zones = np.where(domain, 1, 0).astype(np.float32)  # initialised from tte_domain (TCC == 0 stays 1)
    zones[(t > 0) & (t <= SPARSE_MAX)] = 1
    zones[(t > SPARSE_MAX) & (t <= OPEN_MAX)] = 2
    if tcc_relerr is None:
        zones[t > OPEN_MAX] = 3
    else:
        zones[(t > OPEN_MAX) & (tcc_relerr > RELERR_MAX)] = 3
        zones[(t > OPEN_MAX) & (tcc_relerr < RELERR_MAX)] = 4

    a = abr
    cls = np.zeros(t.shape, dtype=np.float32)
    z1, z2 = zones == 1, zones == 2
    cls[z1 & (a <= -0.5)] = 1
    cls[z1 & (a > -0.5) & (a <= 0)] = 2
    cls[z1 & (a > 0) & (a <= 0.5)] = 3
    cls[z1 & (a > 0.5) & (a < 1)] = 4
    cls[z2 & (a <= -0.5)] = 5
    cls[z2 & (a > -0.5) & (a <= 0)] = 6
    cls[z2 & (a > 0) & (a <= 0.5)] = 7
    cls[z2 & (a > 0.5)] = 8
    cls[zones >= 3] = 9
    lead = z1 & (a == 1)
    cls[lead] = 10
    cls[lead & water] = 11

    nan = np.float32(np.nan)
    return {
        'tte_domain': np.where(domain, 1, nan).astype(np.float32),
        'tte_zones': np.where(keep, zones, nan).astype(np.float32),
        'tte_abruptness': np.where(keep, abr, nan).astype(np.float32),
        'tte_classification': np.where(keep, cls, nan).astype(np.float32),
        'tcc': np.where(keep, t, nan).astype(np.float32),
    }


# ---------------------------------------------------------------------------
# Tile driver
# ---------------------------------------------------------------------------
def load_tile(tile_num, tiles_gpkg=TILES_GPKG):
    import geopandas as gpd
    path = tiles_gpkg
    if path.startswith('s3://'):
        path = '/vsis3/' + path[5:]
    tiles = gpd.read_file(path)
    t = tiles[tiles.tile_num == int(tile_num)]
    if len(t) == 0:
        raise ValueError(f'tile {tile_num} not in {tiles_gpkg}')
    return t.to_crs(4326).geometry.iloc[0]


def footprint_mask(geom_4326, transform, shape):
    """True for LAEA pixels whose centres fall inside the lon/lat tile polygon."""
    from rasterio.features import geometry_mask
    from shapely.ops import transform as shp_transform
    from pyproj import Transformer
    tr = Transformer.from_crs('EPSG:4326', LAEA_CRS, always_xy=True)
    g = shp_transform(tr.transform, geom_4326.segmentize(0.01))
    return geometry_mask([g], out_shape=shape, transform=transform, invert=True)


def write_cog(bands, transform, out_fn, crs=LAEA_CRS, tags=None):
    # Build in local temp space, then copy: GTiff writing needs random access, which the
    # MAAP Hub bucket mounts (~/my-*-bucket) don't support.
    import shutil
    import tempfile
    h, w = next(iter(bands.values())).shape
    tmpdir = tempfile.mkdtemp(prefix='tte_')
    tmp = os.path.join(tmpdir, 'tmp.tif')
    local_fn = os.path.join(tmpdir, os.path.basename(out_fn))
    prof = dict(driver='GTiff', height=h, width=w, count=len(bands), dtype='float32',
                crs=crs, transform=transform, nodata=np.nan, tiled=True,
                blockxsize=512, blockysize=512, compress='deflate', predictor=3)
    with rasterio.open(tmp, 'w', **prof) as dst:
        for i, (name, arr) in enumerate(bands.items(), start=1):
            dst.write(arr.astype(np.float32), i)
            dst.set_band_description(i, name)
        dst.update_tags(**(tags or {}))
        dst.update_tags(4, **{str(k): v for k, v in CLASS_NAMES.items()})
    from rasterio.shutil import copy as rio_copy
    rio_copy(tmp, local_fn, driver='COG', compress='deflate', predictor=3,
             overview_resampling='nearest', blocksize=512)
    shutil.copyfile(local_fn, out_fn)
    shutil.rmtree(tmpdir, ignore_errors=True)
    return out_fn


def run_tile(tile_num, outdir, tcc_source='hansen', tcc_year=2010, hansen_version=HANSEN_VERSION,
             tcc_paths=None, tcc_band=1, tcc_scale=1.0, tcc_resampling='nearest',
             gsw_version=GSW_VERSION, domain_path=DOMAIN_VRT, tiles_gpkg=TILES_GPKG,
             out_name=None, buffer_px=5, emulate_gee=True, stac_entries=None):
    """Run one 1-degree tile; returns the COG path (None outside the TTE domain).
    stac_entries: a list to append this tile's STAC metadata to (see tte_stac.write_catalog)."""
    t0 = time.time()
    geom = load_tile(tile_num, tiles_gpkg)
    transform, shape = laea_grid_for_bounds(geom.bounds, buffer_px)
    print(f'tile {tile_num}: bounds {np.round(geom.bounds, 4)}  LAEA grid {shape}')

    with rasterio.Env(**GDAL_ENV):
        domain = domain_from_path(domain_path, transform, shape)
        print(f'  domain pixels: {domain.sum()}  ({time.time() - t0:.0f}s)')
        if domain.sum() == 0:
            print('  tile is outside the TTE domain; nothing written')
            return None
        if tcc_source == 'hansen':
            tcc = tcc_hansen(transform, shape, year=tcc_year, version=hansen_version, emulate_gee=emulate_gee)
        elif tcc_source == 'meta_chm':                       # latest Meta/WRI canopy height (CHM v2, public on AWS)
            from tte_tcc_sources import tcc_meta_chm
            tcc = tcc_meta_chm(transform, shape, version=META_CHM_VERSION, ht_min=META_HT_MIN)   # % of ~1 m pixels >= ht_min
        else:
            tcc = tcc_from_path(tcc_paths, transform, shape, band=tcc_band, scale=tcc_scale,
                                resampling=Resampling[tcc_resampling])
        print(f'  tcc read  ({time.time() - t0:.0f}s)')
        occ = water_gsw(transform, shape, gsw_version, emulate_gee=emulate_gee)
        print(f'  water read  ({time.time() - t0:.0f}s)')

    out = classify(tcc, domain, occ)

    inside = footprint_mask(geom, transform, shape)
    for k in out:
        out[k][~inside] = np.nan

    os.makedirs(outdir, exist_ok=True)
    src_tag = {'hansen': f'hansen{tcc_year}', 'meta_chm': 'metachm2m'}.get(tcc_source, out_name or 'custom')
    out_fn = os.path.join(outdir, f'tte_{src_tag}_{int(tile_num):07}.tif')
    tags = dict(tcc_source=tcc_source, tcc_year=str(tcc_year),
                tcc_paths=','.join(tcc_paths or []) if tcc_source != 'hansen' else hansen_version,
                water=f'GSW v{gsw_version} occurrence >= {WATER_OCC_MIN}', domain=domain_path,
                gee_pyramid_emulation=str(emulate_gee),
                method='Montesano et al. 2020 ERL 15:105019; port of GEE TTE_DATA_v201902v2',
                classes='; '.join(f'{k}={v}' for k, v in CLASS_NAMES.items()))
    write_cog(out, transform, out_fn, tags=tags)
    n = np.isfinite(out['tte_classification']).sum()
    print(f'  wrote {out_fn}: {n} classified pixels ({time.time() - t0:.0f}s)')
    if stac_entries is not None:
        import tte_stac
        meta = tcc_source == 'meta_chm'
        run_props = tte_stac.run_properties(
            tile_num, tcc_source, src_tag, tcc_year, hansen_version, tcc_paths, tcc_scale, tcc_resampling,
            gsw_version, domain_path, emulate_gee, META_CHM_VERSION if meta else None, META_HT_MIN if meta else None)
        stac_entries.append(dict(cog=out_fn, geom=geom, run_props=run_props,
                                 summary=tte_stac.tile_summary(out, tcc, domain, inside)))
    return out_fn


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--tile_num', required=True, help='tile_num(s) in the tiles gpkg, comma separated')
    p.add_argument('--outdir', required=True)
    p.add_argument('--tcc_source', default='hansen', choices=['hansen', 'path', 'meta_chm'],
                   help="'hansen' = Hansen GFC treecover2000 minus loss before --tcc_year; 'path' = --tcc_paths; "
                        "'meta_chm' = Meta/WRI canopy height v2, percent of ~1 m pixels >= 2 m")
    p.add_argument('--tcc_year', type=int, default=2010)
    p.add_argument('--hansen_version', default=HANSEN_VERSION, help='e.g. GFC-2018-v1.6 (GEE original), GFC-2024-v1.12')
    p.add_argument('--tcc_paths', default='', help='comma-separated rasters/VRTs/COG urls (s3://, https://, local)')
    p.add_argument('--tcc_band', type=int, default=1)
    p.add_argument('--tcc_scale', type=float, default=1.0, help='multiply input to get percent cover 0-100')
    p.add_argument('--tcc_resampling', default='nearest', help='rasterio Resampling name; GEE used nearest')
    p.add_argument('--out_name', default=None, help='label for output file names when --tcc_source path')
    p.add_argument('--gsw_version', default=GSW_VERSION, choices=list(GSW_URL))
    p.add_argument('--domain_path', default=DOMAIN_VRT)
    p.add_argument('--tiles_gpkg', default=TILES_GPKG)
    p.add_argument('--write_stac', action='store_true',
                   help='write catalog.json + STAC items for the output COGs in --outdir (for the MAAP DPS STAC)')
    p.add_argument('--no_gee_emulation', action='store_true',
                   help='read Hansen/GSW at full resolution everywhere (GEE used 2x2 pyramids north of 64.07N)')
    a = p.parse_args()

    tcc_paths = [s for s in a.tcc_paths.split(',') if s]
    if a.tcc_source == 'path' and not tcc_paths:
        sys.exit('--tcc_paths is required with --tcc_source path')

    entries = [] if a.write_stac else None
    for tn in [s for s in str(a.tile_num).split(',') if s]:
        run_tile(int(tn), a.outdir, a.tcc_source, a.tcc_year, a.hansen_version, tcc_paths,
                 a.tcc_band, a.tcc_scale, a.tcc_resampling, a.gsw_version, a.domain_path,
                 a.tiles_gpkg, a.out_name, emulate_gee=not a.no_gee_emulation, stac_entries=entries)
    if entries:
        import tte_stac
        for f in tte_stac.write_catalog(entries, a.outdir):
            print('  STAC item', f)
        print('  STAC catalog', os.path.join(a.outdir, 'catalog.json'))


if __name__ == '__main__':
    main()
