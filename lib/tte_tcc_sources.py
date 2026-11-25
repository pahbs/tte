"""
Tree canopy cover (TCC) inputs for the TTE map (lib/tte_map.py).

The TTE workflow takes any tree cover source by name (`SOURCES`, below): `read_tcc` reads it,
`tcc_label` names the outputs, `tcc_description` describes it in the metadata. Source-specific
settings go in an options string, 'key=value;key=value' (see each source's `options`); the
option `floor` (TCC below it set to 0) works for every source.

Each reader returns percent tree cover (float32, 0-100, NaN = no data) on a target
grid, normally the 30 m north-polar LAEA grid from tte_map.laea_grid_for_bounds.

  tcc_hansen        Hansen et al. 2013 Global Forest Change: treecover2000, loss before `year` removed
  tcc_gee_tte       the TCC stored in the GEE map itself (TTE_DATA_v201902v2 'tcc' band): GEE's
                    input, i.e. cal_2m_tcc in North America, Hansen 2010 in Eurasia. Recoverable
                    inside the TTE domain, because the map only leaves out pixels with TCC 0 and no
                    change around them (abruptness 0/0).
  tcc_above_boreal  Feng et al. 2022, ABoVE: Tree Canopy Cover and Stand Age from Landsat, Boreal
                    Forest Biome, 1984-2020 (ORNL DAAC 2012). Yearly, 47-73 N, locally calibrated.
  tcc_gfcc          Sexton et al. 2013, GFCC30TC v003 (LP DAAC): 2000/2005/2010/2015, WRS-2 scenes.
  tcc_massey        Massey et al. 2023, tree canopy cover, boreal North America 1992-2015 (ORNL DAAC 2296).
  tcc_meta_chm      % of the ~1 m pixels of the Meta/WRI canopy height map that are >= ht_min metres.

The NASA DAAC products are read with MAAP S3 credentials (in a MAAP Hub kernel) or, failing
that, with an Earthdata Login ~/.netrc over https.
"""
import json
import math
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
import urllib.error
import urllib.parse
import urllib.request

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject, transform_bounds
from rasterio.windows import Window, from_bounds

import tte_map as tm

CMR_GRANULES = 'https://cmr.earthdata.nasa.gov/search/granules.json'
S3_CREDENTIALS = {
    'ornl': 'https://data.ornldaac.earthdata.nasa.gov/s3credentials',
    'lpdaac': 'https://data.lpdaac.earthdatacloud.nasa.gov/s3credentials',
}
GDAL_READ = dict(tm.GDAL_ENV, CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif,.TIF,.tiff,.vrt,.zip')

META_CHM = {
    # Tolan et al. 2024 (v1) and the 2025 DINOv3 update (v2); heights in whole metres, EPSG:3857 quadkey tiles
    'v2': dict(url='https://dataforgood-fb-data.s3.amazonaws.com/forests/v2/global/dinov3_global_chm_v2_ml3/chm/{qk}.tif', zoom=10),
    'v1': dict(url='https://dataforgood-fb-data.s3.amazonaws.com/forests/v1/alsgedi_global_v6_float/chm/{qk}.tif', zoom=9),
}


# ---------------------------------------------------------------------------
# Earthdata access
# ---------------------------------------------------------------------------
_CREDS = {}
CLOUD_PROVIDER = {'ornl': 'ORNL_CLOUD', 'lpdaac': 'LPCLOUD'}


def _s3_opts(c):
    get = lambda *ks: next(c[k] for k in ks if k in c)
    return dict(scheme='s3', AWS_ACCESS_KEY_ID=get('accessKeyId', 'AccessKeyId'),
                AWS_SECRET_ACCESS_KEY=get('secretAccessKey', 'SecretAccessKey'),
                AWS_SESSION_TOKEN=get('sessionToken', 'SessionToken'), AWS_REGION='us-west-2')


def earthdata_login(credentials_ini='~/my-private-bucket/credentials.ini'):
    """earthaccess login without prompting: EARTHDATA_USERNAME/PASSWORD in the environment, an .ini
    file with an [EarthData] section (username, password), or ~/.netrc. Returns the Auth or None."""
    import configparser
    import earthaccess
    if os.environ.get('EARTHDATA_USERNAME') and os.environ.get('EARTHDATA_PASSWORD'):
        return earthaccess.login(strategy='environment')
    ini = os.path.expanduser(credentials_ini)
    if os.path.exists(ini):
        cp = configparser.ConfigParser()
        cp.read(ini)
        sec = next((s for s in cp.sections() if s.lower() == 'earthdata'), None)
        if sec:
            keys = {k.lower(): v for k, v in cp[sec].items()}
            user = next((keys[k] for k in ('username', 'user', 'login') if k in keys), None)
            pw = next((keys[k] for k in ('password', 'pass') if k in keys), None)
            if user and pw:
                os.environ['EARTHDATA_USERNAME'], os.environ['EARTHDATA_PASSWORD'] = user, pw
                return earthaccess.login(strategy='environment')
    if os.path.exists(os.path.expanduser('~/.netrc')):
        return earthaccess.login(strategy='netrc')
    return None


def earthdata_options(daac):
    """GDAL options for a DAAC's protected files, plus 'scheme' (s3 or https) to pick the link.
    Tries, in order: maap-py S3 credentials; earthaccess S3 credentials from an Earthdata Login
    (environment, ~/credentials.ini or ~/.netrc, see earthdata_login); https with ~/.netrc."""
    hit = _CREDS.get(daac)
    if hit and time.time() - hit[0] < 50 * 60:          # S3 credentials last 1 hour
        return dict(hit[1])
    opts, errs = None, []
    try:
        from maap.maap import MAAP
        opts = _s3_opts(MAAP().aws.earthdata_s3_credentials(S3_CREDENTIALS[daac]))
    except Exception as e:
        errs.append(f'maap-py: {str(e)[:80]}')
    if opts is None:
        try:
            if earthdata_login() is not None:
                import earthaccess
                opts = _s3_opts(earthaccess.get_s3_credentials(provider=CLOUD_PROVIDER[daac]))
            else:
                errs.append('earthaccess: no Earthdata Login found')
        except Exception as e:
            errs.append(f'earthaccess: {str(e)[:80]}')
    if opts is None and os.path.exists(os.path.expanduser('~/.netrc')):
        jar = os.path.expanduser('~/.edl_cookies')
        opts = dict(scheme='https', GDAL_HTTP_NETRC='YES', GDAL_HTTP_COOKIEFILE=jar, GDAL_HTTP_COOKIEJAR=jar)
    if opts is None:
        raise RuntimeError(f'no Earthdata access for {daac}: log in to Earthdata once (see the notebook\'s '
                           f'"Earthdata login" cell, which saves ~/.netrc). Tried: {"; ".join(errs)}')
    _CREDS[daac] = (time.time(), opts)
    return dict(opts)


def cmr_granules(short_name, box, year=None, title_contains=None):
    """Granules of a CMR collection over a lon/lat box: list of dict(title, s3, https) data links."""
    params = [('short_name', short_name), ('bounding_box', ','.join(f'{v:.5f}' for v in box)), ('page_size', 200)]
    if year is not None:
        params.append(('temporal', f'{year}-01-01T00:00:00Z,{year}-12-31T23:59:59Z'))
    with urllib.request.urlopen(CMR_GRANULES + '?' + urllib.parse.urlencode(params), timeout=60) as r:
        entries = json.load(r)['feed']['entry']
    out = []
    for e in entries:
        if title_contains and title_contains not in e['title']:
            continue
        links = [l['href'] for l in e.get('links', []) if l['href'].endswith(('.tif', '.zip'))]
        out.append(dict(title=e['title'],
                        s3=[h for h in links if h.startswith('s3://') and 'public' not in h],
                        https=[h for h in links if h.startswith('https://') and 'public' not in h]))
    return out


def _gdal_path(link, inner=None):
    p = '/vsis3/' + link[5:] if link.startswith('s3://') else '/vsicurl/' + link
    return f'/vsizip/{{{p}}}/{inner}' if inner else p


def _read_daac(daac, granules, transform, shape, inner=None, **kw):
    opts = earthdata_options(daac)
    scheme = opts.pop('scheme')
    paths = []
    for g in granules:
        links = g[scheme]
        if links:
            paths.append(_gdal_path(links[0], inner(g) if inner else None))
    if not paths:
        return np.full(shape, np.nan, np.float32)
    session = None
    if scheme == 's3':
        # rasterio takes AWS credentials only through a session, not as GDAL options
        from rasterio.session import AWSSession
        session = AWSSession(aws_access_key_id=opts.pop('AWS_ACCESS_KEY_ID'),
                             aws_secret_access_key=opts.pop('AWS_SECRET_ACCESS_KEY'),
                             aws_session_token=opts.pop('AWS_SESSION_TOKEN'),
                             region_name=opts.pop('AWS_REGION', 'us-west-2'))
    with rasterio.Env(session=session, **GDAL_READ, **opts):
        return tm.read_to_grid(paths, transform, shape, **kw)


def _box(transform, shape, pad=0.02):
    boxes = tm.lonlat_boxes(transform, shape, pad=pad)
    if len(boxes) > 1:
        raise NotImplementedError('grids crossing the antimeridian are not handled for this source')
    return boxes[0]


def _clean(tc, valid_max=100):
    tc = tc.astype(np.float32)
    tc[(tc < 0) | (tc > valid_max)] = np.nan
    return tc


# ---------------------------------------------------------------------------
# Readers
# ---------------------------------------------------------------------------
def tcc_gee_tte(transform, shape, paths):
    """TCC used by the GEE map (band 'tcc' of TTE_DATA_v201902v2 tiles, EPSG:4326 downloads).
    Unclassified domain pixels had TCC 0, so NaN -> 0; the domain mask is applied later."""
    tc = tm.read_to_grid(paths, transform, shape, band=5)
    return np.nan_to_num(_clean(tc), nan=0.0)


def tcc_above_boreal(transform, shape, year, resampling=Resampling.nearest):
    """Feng et al. 2022 ABoVE boreal TCC (ORNL DAAC 2012): 2.5-degree COGs, EPSG:4326, 0.00025 deg, nodata 255."""
    g = cmr_granules('Boreal_CanopyCover_StandAge_2012', _box(transform, shape), year, f'_tcc_{year}.tif')
    return _clean(_read_daac('ornl', g, transform, shape, resampling=resampling, src_nodata=255))


def tcc_massey(transform, shape, year, resampling=Resampling.nearest):
    """Massey et al. 2023 TCC, boreal North America (ORNL DAAC 2296): one COG per nominal year,
    EPSG:4326, percent; water and no-data are 0 (no nodata value)."""
    g = cmr_granules('DeciduousFractionl_CanopyCover_2296', _box(transform, shape), year,
                     f'treecanopycover_{year}_prediction.tif')
    return _clean(_read_daac('ornl', g, transform, shape, resampling=resampling))


def tcc_gfcc(transform, shape, year, resampling=Resampling.nearest):
    """GFCC30TC v003 (LP DAAC): one zip per WRS-2 path/row with pPPPrRRR_TC_YYYY.tif (UTM).
    0-100 tree cover, 200 water (-> 0), 210 cloud, 211 shadow, 220 fill (-> NaN); the files' nodata is 255.
    Overlapping scenes: the first valid value is kept, so later scenes fill clouds."""
    granules = cmr_granules('GFCC30TC', _box(transform, shape), year, f'_TC_{year}')
    inner = lambda g: g['title'].replace('GFCC30TC_', '') + '.tif'
    out = np.full(shape, np.nan, np.float32)
    for g in granules:
        # one scene at a time: codes (and the files' nodata 255) must be removed before mosaicking
        tc = _read_daac('lpdaac', [g], transform, shape, inner=inner, resampling=resampling)
        tc[tc >= 210] = np.nan
        tc[tc == 200] = 0
        tc = _clean(tc)
        fill = np.isnan(out) & ~np.isnan(tc)
        out[fill] = tc[fill]
    return out


def zero_floor(tcc, floor=5):
    """TCC below `floor` (%) set to 0 (NaN stays NaN): turns a low non-zero background back into
    'no trees', which the TTE workflow needs (TCC 0 is left out or is the non-forest edge)."""
    out = tcc.copy()
    out[out < floor] = 0
    return out


def _tile_xy(lon, lat, z):
    n = 2 ** z
    lat = max(min(lat, 85.0511), -85.0511)
    x = int((lon + 180.0) / 360.0 * n)
    y = int((1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n)
    return min(max(x, 0), n - 1), min(max(y, 0), n - 1)


def _quadkey(x, y, z):
    return ''.join(str(((x >> i) & 1) + 2 * ((y >> i) & 1)) for i in range(z - 1, -1, -1))


def meta_quadkeys(box, zoom):
    w, s, e, n = box
    x0, y0 = _tile_xy(w, n, zoom)
    x1, y1 = _tile_xy(e, s, zoom)
    return [_quadkey(x, y, zoom) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]


def _need_points(need, transform, step=8):
    """EPSG:3857 x, y of points every `step` cells on the needed area, grown by one step (None = the whole grid)."""
    h, w = need.shape
    H, W = -(-h // step), -(-w // step)
    c = np.zeros((H * step, W * step), bool)
    c[:h, :w] = need
    c = c.reshape(H, step, W, step).any(axis=(1, 3))
    g = np.pad(c, 1)                                         # grow by one coarse cell, 8 directions
    g = np.logical_or.reduce([np.roll(g, (a, b), (0, 1)) for a in (-1, 0, 1) for b in (-1, 0, 1)])
    r, k = np.nonzero(g)
    x = transform.c + ((k - 1) + 0.5) * step * transform.a
    y = transform.f + ((r - 1) + 0.5) * step * transform.e
    from pyproj import Transformer
    return Transformer.from_crs(tm.LAEA_CRS, 'EPSG:3857', always_xy=True).transform(x, y)


MERC = 20037508.342789244


def _exists(url, tries=6):
    """False only if the server says the file is not there (404); other failures are retried, then raised."""
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=60):
                return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            err = e
        except OSError as e:
            err = e
        time.sleep(2 ** i)
    raise RuntimeError(f'cannot check {url}: {err}')


def tcc_meta_chm(transform, shape, version, ht_min, need=None, block=2048, factor=8, threads=8, files=1):
    """Percent of canopy height map pixels >= ht_min (m) in each grid cell (Meta/WRI, ~1.2 m in
    EPSG:3857, ~0.4-0.5 m on the ground at 65-72 N).
    Each tile is read block by block and reduced in numpy to `factor` x `factor` counts of tall and
    valid pixels (~3.5 m on the ground at factor 8), then the counts are warped to the grid once
    with Resampling.sum, so every source pixel counts once.
    need: boolean grid, the cells whose value is used; only the files and blocks under them are read (other
    cells are undefined). files: how many files are processed at once; each needs about 1-3 GB, so 1 fits an 8 GB worker."""
    cfg = META_CHM[version]
    tall = np.zeros(shape, np.float64)
    valid = np.zeros(shape, np.float64)
    h, w = shape
    F = factor
    block = (block // F) * F
    gx = (transform.c, transform.c + w * transform.a)
    gy = (transform.f + h * transform.e, transform.f)
    env = dict(GTIFF_SRS_SOURCE='EPSG', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CPL_VSIL_CURL_ALLOWED_EXTENSIONS='.tif',
               GDAL_HTTP_MAX_RETRY='5', GDAL_HTTP_RETRY_DELAY='3', GDAL_CACHEMAX=512)
    n = 2 ** cfg['zoom']
    size = 2 * MERC / n                                      # width of a file in EPSG:3857
    px, py = _need_points(np.ones(shape, bool) if need is None else need, transform)
    tx = np.floor((px + MERC) / size).astype(int) % n
    ty = np.floor((MERC - py) / size).astype(int)
    by_file = {}
    for key in sorted(set(zip(ty.tolist(), tx.tolist()))):   # rows, then columns, as meta_quadkeys
        by_file[key] = (tx == key[1]) & (ty == key[0])

    def one(key):
        """One file: (row0, col0, warped tall, warped valid) over the part of the grid it fills, or None."""
        url = cfg['url'].format(qk=_quadkey(key[1], key[0], cfg['zoom']))
        with rasterio.Env(**env):
            for i in range(4):
                try:
                    src = rasterio.open('/vsicurl/' + url)
                    break
                except rasterio.errors.RasterioIOError:
                    if not _exists(url):
                        return None                          # no tile here (ocean, no coverage)
                    if i == 3:
                        raise
                    time.sleep(3 * (i + 1))
            with src:
                b = transform_bounds(tm.LAEA_CRS, src.crs, gx[0], gy[0], gx[1], gy[1], densify_pts=51)
                if b[0] > b[2]:
                    b = (-MERC, b[1], MERC, b[3])            # grid crosses the antimeridian
                win = from_bounds(*b, src.transform)
                # window snapped to multiples of F (tiles are 2^n pixels wide, so F divides them)
                r0 = max(int(win.row_off) // F * F, 0)
                c0 = max(int(win.col_off) // F * F, 0)
                r1 = min(int(math.ceil((win.row_off + win.height) / F)) * F, src.height)
                c1 = min(int(math.ceil((win.col_off + win.width) / F)) * F, src.width)
                if r1 <= r0 or c1 <= c0:
                    return None
                # the blocks under needed cells
                m = by_file[key]
                pc = ((px[m] - src.transform.c) / src.transform.a).astype(int)
                pr = ((py[m] - src.transform.f) / src.transform.e).astype(int)
                ok = (pr >= r0) & (pr < r1) & (pc >= c0) & (pc < c1)
                jobs = sorted({(r0 + int(r) * block, c0 + int(c) * block)
                               for r, c in set(zip(((pr[ok] - r0) // block).tolist(), ((pc[ok] - c0) // block).tolist()))})
                if not jobs:
                    return None
                n_tall = np.zeros(((r1 - r0) // F, (c1 - c0) // F), np.float32)
                n_ok = np.zeros_like(n_tall)
                name = src.name
                local = threading.local()
                handles = []

                def count(rc):
                    # read one block (each thread has its own handle) and count per F x F cell
                    r, c = rc
                    if not hasattr(local, 'src'):
                        local.env = rasterio.Env(**env)          # GDAL options are per thread
                        local.env.__enter__()
                        local.src = rasterio.open(name)
                        handles.append((local.env, local.src))
                    ww = Window(c, r, min(block, c1 - c), min(block, r1 - r))
                    a = local.src.read(1, window=ww, masked=True)
                    ok = ~np.ma.getmaskarray(a)
                    hh, wd = a.shape
                    red = lambda m: m.reshape(hh // F, F, wd // F, F).sum(axis=(1, 3), dtype=np.int32)
                    return r, c, red((a.data >= ht_min) & ok), red(ok)

                with ThreadPoolExecutor(max_workers=max(1, threads // 2)) as ex:
                    for r, c, nt, no in ex.map(count, jobs):
                        rr, cc = (r - r0) // F, (c - c0) // F
                        n_tall[rr:rr + nt.shape[0], cc:cc + nt.shape[1]] = nt
                        n_ok[rr:rr + no.shape[0], cc:cc + no.shape[1]] = no
                for e, s in handles:
                    s.close()
                st = src.window_transform(Window(c0, r0, c1 - c0, r1 - r0)) * rasterio.Affine.scale(F)
                # both layers in one warp; pixels with no valid count (blocks not read) are skipped, or GDAL would spend the
                # same time on them. 128 MB = GDAL's default 64 MB per layer: the warp is split as for one layer, so the
                # result is bit-identical to warping each layer by itself.
                got = np.full((2,) + shape, -9999, np.float32)
                reproject(np.stack([n_tall, n_ok]), got, src_transform=st, src_crs=src.crs, src_nodata=0, dst_transform=transform,
                          dst_crs=tm.LAEA_CRS, dst_nodata=-9999, resampling=Resampling.sum, warp_mem_limit=128,
                          UNIFIED_SRC_NODATA='YES')
                got[got == -9999] = 0
                rows, cols = np.nonzero(got[1].any(axis=1))[0], np.nonzero(got[1].any(axis=0))[0]
                if not len(rows):
                    return None
                a, z, p, q = rows[0], rows[-1] + 1, cols[0], cols[-1] + 1
                return a, p, got[0][a:z, p:q].copy(), got[1][a:z, p:q].copy()

    with ThreadPoolExecutor(max_workers=files) as ex:
        for r in ex.map(one, by_file):                       # added in file order
            if r is not None:
                a, p, t, v = r
                tall[a:a + t.shape[0], p:p + t.shape[1]] += t
                valid[a:a + v.shape[0], p:p + v.shape[1]] += v
    with np.errstate(invalid='ignore', divide='ignore'):
        return np.where(valid > 0.5, 100.0 * tall / valid, np.nan).astype(np.float32)


# ---------------------------------------------------------------------------
# Hansen et al. (2013) Global Forest Change
# ---------------------------------------------------------------------------
HANSEN_URL = ('https://storage.googleapis.com/earthenginepartners-hansen/'
              '{ver}/Hansen_{ver}_{layer}_{lat}_{lon}.tif')


def hansen_urls(keys, layer, version):
    return [HANSEN_URL.format(ver=version, layer=layer, lat=tm._fmt_lat(t, 2), lon=tm._fmt_lon(l, 3))
            for t, l in keys]


def tcc_hansen(transform, shape, year, version, emulate_gee=True):
    """treecover2000 of GFC release `version` (e.g. GFC-2018-v1.6, GFC-2025-v1.13), with loss from 2001
    to year-1 set to 0 (as GEE's tcc_han_2010). emulate_gee: read 2x2 pyramids north of 64.07 N as GEE did."""
    keys = tm.tiles_10deg(*tm.grid_lonlat_extent(transform, shape))
    if emulate_gee:
        tc = tm.read_tiles_gee(hansen_urls(keys, 'treecover2000', version), transform, shape, 'mean_round')
        ly = tm.read_tiles_gee(hansen_urls(keys, 'lossyear', version), transform, shape, 'sample')
    else:
        tc = tm.read_to_grid(hansen_urls(keys, 'treecover2000', version), transform, shape)
        ly = tm.read_to_grid(hansen_urls(keys, 'lossyear', version), transform, shape)
    loss = (ly > 0) & (ly < (year - 2000))
    # GEE: tcc2000.not().updateMask(loss).unmask(tcc2000) -> loss pixels become (tcc2000 == 0)
    tc[loss] = (tc[loss] == 0).astype(np.float32)
    return tc


# ---------------------------------------------------------------------------
# Registry: the tree cover sources the TTE workflow (tte_map.py, DPS run_tte_map) takes by name
# ---------------------------------------------------------------------------
def parse_options(options):
    """'key=value;key=value' (or a dict) -> dict of strings. '', 'none' or None -> {}."""
    if isinstance(options, dict):
        return {str(k): str(v) for k, v in options.items()}
    out = {}
    for part in str(options or '').split(';'):
        part = part.strip()
        if not part or part.lower() == 'none':
            continue
        if '=' not in part:
            raise ValueError(f"tcc option '{part}' is not key=value")
        k, v = part.split('=', 1)
        out[k.strip()] = v.strip()
    return out


def _num(v):
    f = float(v)
    return int(f) if f.is_integer() else f


SOURCES = {
    'hansen': dict(
        doc='Hansen et al. (2013) Global Forest Change: treecover2000 with loss from 2001 to tcc_year-1 set to 0',
        options={'version': 'GFC release on storage.googleapis.com, required (GFC-2018-v1.6 = the version '
                            'the GEE map used; GFC-2025-v1.13 = latest as of 2026)'},
        required=['version'],
        read=lambda tr, sh, year, o, paths, emulate: tcc_hansen(tr, sh, year, o['version'], emulate),
        label=lambda year, o: f'hansen{year}',
        describe=lambda year, o: (f"Hansen et al. (2013) Global Forest Change {o['version']}: treecover2000 "
                                  f"with loss from 2001 to {year - 1} set to 0")),
    'meta_chm': dict(
        doc='Meta/WRI canopy height map: percent of ~1 m pixels >= ht_min m in each 30 m cell',
        options={'version': "canopy height map version, 'v2' (DINOv3, 2025) or 'v1' (Tolan et al. 2024); required",
                 'ht_min': 'canopy height (m) counted as tree cover; required'},
        required=['version', 'ht_min'],
        uses_need=True,
        read=lambda tr, sh, year, o, paths, emulate, need=None: tcc_meta_chm(tr, sh, o['version'], float(o['ht_min']), need),
        label=lambda year, o: f"metachm{o['version']}_{_num(o['ht_min'])}m",
        describe=lambda year, o: (f"Meta/WRI canopy height map {o['version']}: percent of ~1 m pixels >= "
                                  f"{_num(o['ht_min'])} m in each 30 m cell (imagery dates vary by place; "
                                  f"tcc_year {year} is nominal)")),
    'path': dict(
        doc='percent tree cover rasters or VRTs given in tcc_paths (any CRS); label them with out_name',
        options={'scale': 'factor to get percent cover 0-100 (default 1)',
                 'resampling': 'rasterio resampling to the 30 m grid (default nearest, as GEE)',
                 'band': 'band to read (default 1)'},
        required=[],
        read=lambda tr, sh, year, o, paths, emulate: tm.tcc_from_path(
            paths, tr, sh, band=int(o.get('band', 1)), scale=float(o.get('scale', 1)),
            resampling=Resampling[o.get('resampling', 'nearest')]),
        label=lambda year, o: None,          # out_name is required for 'path'
        describe=lambda year, o: 'tree canopy cover rasters in tte:tcc_paths'),
    'above_boreal': dict(
        doc='Feng et al. (2022) ABoVE boreal tree canopy cover from Landsat, yearly 1984-2020, 47-73 N (ORNL DAAC 2012); Earthdata',
        options={}, required=[],
        read=lambda tr, sh, year, o, paths, emulate: tcc_above_boreal(tr, sh, year),
        label=lambda year, o: f'above{year}',
        describe=lambda year, o: f'Feng et al. (2022) ABoVE boreal tree canopy cover {year} (ORNL DAAC, doi:10.3334/ORNLDAAC/2012)'),
    'gfcc': dict(
        doc='Sexton et al. (2013) GFCC30TC v003 tree cover, 2000/2005/2010/2015 (LP DAAC); Earthdata',
        options={}, required=[],
        read=lambda tr, sh, year, o, paths, emulate: tcc_gfcc(tr, sh, year),
        label=lambda year, o: f'gfcc{year}',
        describe=lambda year, o: f'Sexton et al. (2013) GFCC30TC v003 tree cover {year} (LP DAAC)'),
    'massey': dict(
        doc='Massey et al. (2023) tree canopy cover, boreal North America, 1992-2015 every 5 years (ORNL DAAC 2296); Earthdata',
        options={}, required=[],
        read=lambda tr, sh, year, o, paths, emulate: tcc_massey(tr, sh, year),
        label=lambda year, o: f'massey{year}',
        describe=lambda year, o: f'Massey et al. (2023) tree canopy cover {year}, boreal North America (ORNL DAAC 2296)'),
}
GENERIC_OPTIONS = {'floor': 'TCC below this (%) set to 0 after reading, for any source (e.g. floor=5)'}


def _checked(source, options):
    if source not in SOURCES:
        raise ValueError(f"unknown tcc_source '{source}'; choose one of {sorted(SOURCES)}")
    o = parse_options(options)
    known = set(SOURCES[source]['options']) | set(GENERIC_OPTIONS)
    unknown = set(o) - known
    if unknown:
        raise ValueError(f"tcc_source '{source}' has no option(s) {sorted(unknown)}; options: {sorted(known)}")
    missing = [k for k in SOURCES[source]['required'] if k not in o]
    if missing:
        raise ValueError(f"tcc_source '{source}' needs option(s) {missing} in tcc_options, e.g. "
                         + ';'.join(f'{k}=...' for k in missing))
    return o


def read_tcc(source, transform, shape, year, options=None, paths=None, emulate_gee=True, need=None):
    """Tree cover (%) of a registered source on the grid; applies the generic `floor` option.
    need: boolean grid of the cells whose value is used; sources with uses_need may leave out the others."""
    o = _checked(source, options)
    kw = dict(need=need) if SOURCES[source].get('uses_need') else {}
    tcc = SOURCES[source]['read'](transform, shape, int(year), o, list(paths or []), emulate_gee, **kw)
    if 'floor' in o:
        tcc = zero_floor(tcc, float(o['floor']))
    return tcc


def tcc_label(source, year, options=None, out_name=None):
    """Short name of a run, used in output file names and STAC (tte:tcc_label). out_name overrides."""
    if out_name:
        return out_name
    o = _checked(source, options)
    lab = SOURCES[source]['label'](int(year), o)
    if lab is None:
        raise ValueError(f"tcc_source '{source}' needs out_name (a label for the outputs)")
    if 'floor' in o:
        lab += f"_floor{_num(o['floor'])}"
    return lab


def tcc_description(source, year, options=None):
    o = _checked(source, options)
    d = SOURCES[source]['describe'](int(year), o)
    if 'floor' in o:
        d += f"; TCC below {_num(o['floor'])} % set to 0"
    return d


def list_sources():
    """Printable summary of the sources and their options."""
    lines = []
    for name, s in SOURCES.items():
        lines.append(f"{name}: {s['doc']}")
        for k, v in s['options'].items():
            lines.append(f"    {k}: {v}")
    lines.append('any source:')
    lines += [f'    {k}: {v}' for k, v in GENERIC_OPTIONS.items()]
    return '\n'.join(lines)
