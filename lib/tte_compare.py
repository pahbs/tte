"""
Helpers for notebooks that compare TTE maps made from different tree canopy cover (TCC) inputs
with the original GEE map (projects/foreststructure/TTE_DATA_v201902v2, circa 2010) on square sites.

A site is a centre (lon, lat) and a size in km. Each input is run with tte_map.classify on the
map's own 30 m polar LAEA grid (square plus a margin), saved as one COG per site and input, and
shown on a north-up square (local LAEA, 30 m, nearest neighbour) next to the GEE map.

A "source" is dict(label=..., run=f) with f(transform, shape, lon, lat) -> TCC (%), NaN = no data.
"""
import functools
import os
import re
import time

import numpy as np
import pandas as pd
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject

import tte_map as tm

TILES_GPKG = '/home/jovyan/my-public-bucket/databank/tte_tiles.gpkg'
DOMAIN_PATH = '/home/jovyan/my-public-bucket/tte/static/tte_domain_v201902v2_hubmount.vrt'
GEE_TINDEX = ('/home/jovyan/my-public-bucket/DPS_tile_lists/TTE/download_gee_tiles_v1/'
              'tte_montesano_2010_30m/TTE_tindex_master.csv')
if not os.path.exists(TILES_GPKG):
    TILES_GPKG, DOMAIN_PATH = tm.TILES_GPKG, tm.DOMAIN_VRT

DOMAIN_COLOR = '#787878'
TCC_COLORS = ['#8c510a', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#005a32']   # GEE tcc_viz
GROUPS = {'sparse (1-4)': [1, 2, 3, 4], 'open (5-8)': [5, 6, 7, 8], 'intermediate & closed (9)': [9],
          'non-forest edge (10-11)': [10, 11]}
GROUP_COLORS = ['#ff7f00', '#91cf60', '#a0a0a0', '#ff0000']
DISPLAY_BANDS = ('tte_domain', 'tte_classification', 'tcc_input')


def slug(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


# ---------------------------------------------------------------------------
# Grids
# ---------------------------------------------------------------------------
def display_grid(lon, lat, size_km, res=30):
    """North-up square centred on the site (local LAEA), extent in km from the centre."""
    crs = CRS.from_proj4(f'+proj=laea +lat_0={lat} +lon_0={lon} +datum=WGS84 +units=m +no_defs')
    h = size_km * 500.0
    n = int(round(2 * h / res))
    return dict(crs=crs, transform=from_origin(-h, h, res, res), shape=(n, n), res=res,
                extent=[-h / 1e3, h / 1e3, -h / 1e3, h / 1e3])


def compute_grid(dgrid, buffer_px=10):
    """The TTE map's polar 30 m grid covering the display square plus a margin."""
    from pyproj import Transformer
    h = dgrid['extent'][1] * 1e3
    s = np.linspace(-h, h, 60)
    xs = np.r_[s, np.full(60, h), s[::-1], np.full(60, -h)]
    ys = np.r_[np.full(60, -h), s, np.full(60, h), s[::-1]]
    lo, la = Transformer.from_crs(dgrid['crs'], 'EPSG:4326', always_xy=True).transform(xs, ys)
    return tm.laea_grid_for_bounds((min(lo), min(la), max(lo), max(la)), buffer_px=buffer_px)


# ---------------------------------------------------------------------------
# The GEE map (reference)
# ---------------------------------------------------------------------------
@functools.lru_cache(maxsize=1)
def _gee_tables():
    import geopandas as gpd
    path = TILES_GPKG if not TILES_GPKG.startswith('s3://') else '/vsis3/' + TILES_GPKG[5:]
    tiles = gpd.read_file(path).to_crs(4326)[['tile_num', 'geometry']]
    return tiles, pd.read_csv(GEE_TINDEX)


def gee_paths(lon, lat, pad=0.3):
    """GEE TTE_DATA_v201902v2 download tiles (EPSG:4326, 1 degree) around a point."""
    from shapely.geometry import box
    tiles, index = _gee_tables()
    dx = pad / np.cos(np.radians(lat))
    out = []
    for t in tiles[tiles.intersects(box(lon - dx, lat - pad, lon + dx, lat + pad))].tile_num:
        r = index[index.tile_num == t]
        if len(r):
            p = r.local_path.values[-1].replace('/projects/', '/home/jovyan/')
            out.append(p if os.path.exists(p) else r.s3_path.values[-1])
    return out


def _warp_band(src, band, dgrid):
    tmp = np.full(dgrid['shape'], np.nan, np.float32)
    reproject(rasterio.band(src, band), tmp, src_nodata=src.nodata, dst_transform=dgrid['transform'],
              dst_crs=dgrid['crs'], dst_nodata=np.nan, resampling=Resampling.nearest)
    tmp[~np.isfinite(tmp)] = np.nan
    return tmp


def reference_display(lon, lat, dgrid):
    """The published GEE map on the display square; 'tcc_input' is the GEE 'tcc' band."""
    out = {b: np.full(dgrid['shape'], np.nan, np.float32) for b in DISPLAY_BANDS}
    src_band = {'tte_domain': 'tte_domain', 'tte_classification': 'tte_classification', 'tcc_input': 'tcc'}
    with rasterio.Env(**tm.GDAL_ENV):
        for p in gee_paths(lon, lat):
            with rasterio.open(tm.as_gdal_path(p)) as src:
                names = list(src.descriptions)
                for b, gb in src_band.items():
                    tmp = _warp_band(src, names.index(gb) + 1, dgrid)
                    fill = np.isnan(out[b]) & ~np.isnan(tmp)
                    out[b][fill] = tmp[fill]
    # unclassified domain pixels had TCC 0 in the GEE workflow
    out['tcc_input'][np.isfinite(out['tte_domain']) & np.isnan(out['tcc_input'])] = 0
    return out


def file_display(path, dgrid):
    with rasterio.open(path) as src:
        names = list(src.descriptions)
        return {b: _warp_band(src, names.index(b) + 1, dgrid) for b in DISPLAY_BANDS if b in names}


# ---------------------------------------------------------------------------
# Runs
# ---------------------------------------------------------------------------
def out_path(out_dir, site, key):
    return os.path.join(out_dir, slug(site), f'tte_{key}.tif')


def run_sites(sites, sources, out_dir, size_km, redo=False, domain_path=None):
    """Run every source at every site (skipping saved results). Returns {(site, key): status}."""
    domain_path = domain_path or DOMAIN_PATH
    status = {}
    for site, (lon, lat) in sites.items():
        todo = [k for k in sources if redo or not os.path.exists(out_path(out_dir, site, k))]
        status.update({(site, k): 'done' for k in sources if k not in todo})
        if not todo:
            continue
        t0 = time.time()
        transform, shape = compute_grid(display_grid(lon, lat, size_km))
        with rasterio.Env(**tm.GDAL_ENV):
            domain = tm.domain_from_path(domain_path, transform, shape)
            water = tm.water_gsw(transform, shape)
        print(f'{site}: grid {shape}, {domain.mean():.0%} in the TTE domain ({time.time() - t0:.0f}s)')
        for k in todo:
            t1 = time.time()
            try:
                with rasterio.Env(**tm.GDAL_ENV):
                    tcc = sources[k]['run'](transform, shape, lon, lat)
                if not np.isfinite(tcc[domain]).any():
                    status[(site, k)] = 'no data at this site'
                    print(f'  {k}: no data at this site')
                    continue
                out = tm.classify(tcc, domain, water)
                out['tcc_input'] = np.where(domain, tcc, np.nan).astype(np.float32)
                fn = out_path(out_dir, site, k)
                os.makedirs(os.path.dirname(fn), exist_ok=True)
                tm.write_cog(out, transform, fn, tags=dict(site=site, lon=str(lon), lat=str(lat), tcc_source=k))
                status[(site, k)] = 'done'
                print(f'  {k}: {np.isfinite(out["tte_classification"]).sum()} classified px ({time.time() - t1:.0f}s)')
            except Exception as e:
                msg = str(e).splitlines()[0] if str(e) else type(e).__name__
                status[(site, k)] = 'failed: ' + msg[:150]
                print(f'  {k}: FAILED {msg[:200]}')
    return status


def load_display(sites, keys, out_dir, size_km):
    """{(site, key): bands on the display square, or None}; key 'reference' is the GEE map."""
    disp = {}
    for site, (lon, lat) in sites.items():
        dgrid = display_grid(lon, lat, size_km)
        disp[(site, 'reference')] = reference_display(lon, lat, dgrid)
        for k in keys:
            fn = out_path(out_dir, site, k)
            disp[(site, k)] = file_display(fn, dgrid) if os.path.exists(fn) else None
    return disp


def ref_grid(lon, lat, size_km):
    """The EPSG:4326 pixel grid of the GEE download tile holding the site centre, over the square.
    Pixel agreement is measured here, so the Python map is resampled once and the GEE map not at
    all (as in tte/validate_tte_vs_gee.py). 'inside' marks pixel centres inside the square."""
    from pyproj import Transformer
    from rasterio.transform import Affine
    dg = display_grid(lon, lat, size_km)
    tr0 = None
    for p in gee_paths(lon, lat, pad=0.05):
        with rasterio.open(tm.as_gdal_path(p)) as src:
            b = src.bounds
            if b.left <= lon <= b.right and b.bottom <= lat <= b.top:
                tr0 = src.transform
                break
    if tr0 is None:
        return None
    h = size_km * 500.0
    s = np.linspace(-h, h, 60)
    xs = np.r_[s, np.full(60, h), s[::-1], np.full(60, -h)]
    ys = np.r_[np.full(60, -h), s, np.full(60, h), s[::-1]]
    lo, la = Transformer.from_crs(dg['crs'], 'EPSG:4326', always_xy=True).transform(xs, ys)
    rx, ry = tr0.a, -tr0.e
    c0, c1 = int(np.floor((min(lo) - tr0.c) / rx)), int(np.ceil((max(lo) - tr0.c) / rx))
    r0, r1 = int(np.floor((tr0.f - max(la)) / ry)), int(np.ceil((tr0.f - min(la)) / ry))
    transform = tr0 * Affine.translation(c0, r0)
    shape = (r1 - r0, c1 - c0)
    rr, cc = np.mgrid[0:shape[0], 0:shape[1]]
    px, py = transform * (cc + 0.5, rr + 0.5)
    X, Y = Transformer.from_crs('EPSG:4326', dg['crs'], always_xy=True).transform(px, py)
    return dict(crs=CRS.from_epsg(4326), transform=transform, shape=shape,
                inside=(np.abs(X) <= h) & (np.abs(Y) <= h))


def load_pixel_maps(sites, keys, out_dir, size_km):
    """Like load_display, but on ref_grid (GEE tile pixels), masked to the square: for agreement."""
    out = {}
    for site, (lon, lat) in sites.items():
        g = ref_grid(lon, lat, size_km)
        if g is None:
            continue
        ref = reference_display(lon, lat, g)
        for b in ref:
            ref[b][~g['inside']] = np.nan
        out[(site, 'reference')] = ref
        for k in keys:
            fn = out_path(out_dir, site, k)
            if not os.path.exists(fn):
                continue
            m = file_display(fn, g)
            for b in m:
                m[b][~g['inside']] = np.nan
            out[(site, k)] = m
    return out


# ---------------------------------------------------------------------------
# Numbers
# ---------------------------------------------------------------------------
def agreement(ref, m, res=30):
    """same_class: same class where both are classified; overlap: classified in both / in either."""
    cr, cm = ref['tte_classification'], m['tte_classification']
    both, either = np.isfinite(cr) & np.isfinite(cm), np.isfinite(cr) | np.isfinite(cm)
    n = int(np.isfinite(cm).sum())
    dom = np.isfinite(m['tte_domain'])
    return dict(same_class=float((cr[both] == cm[both]).mean()) if both.any() else np.nan,
                overlap=both.sum() / either.sum() if either.any() else np.nan,
                classified_km2=n * res ** 2 / 1e6,
                closed_pct=100 * float((cm == 9).sum()) / n if n else np.nan,
                mean_tcc=float(np.nanmean(m['tcc_input'][dom])) if 'tcc_input' in m and dom.any() else np.nan)


def agreement_table(disp, sites, columns, res=30, pixel_maps=None):
    """Areas and mean TCC from the (equal-area) display squares; same_class and overlap from
    pixel_maps (load_pixel_maps) when given, else from the display squares."""
    rows = []
    for site in sites:
        ref = disp[(site, 'reference')]
        for k in columns:
            m = disp.get((site, k))
            if m is None:
                continue
            row = dict(site=site, input=k, **agreement(ref, m, res))
            if pixel_maps is not None and (site, k) in pixel_maps and (site, 'reference') in pixel_maps:
                a = agreement(pixel_maps[(site, 'reference')], pixel_maps[(site, k)])
                row.update(same_class=a['same_class'], overlap=a['overlap'])
            rows.append(row)
    return pd.DataFrame(rows)


def styled(table, fmt, caption):
    """Shaded table; missing cells light gray."""
    return (table.style.format(fmt, na_rep='-').background_gradient(cmap='Greens', axis=None)
            .highlight_null(color='#eeeeee').set_caption(caption))


def group_areas(disp, sites, columns, res=30):
    """Area (km2) of each structure group per site and input."""
    rows = []
    for site in sites:
        for k in columns:
            m = disp.get((site, k))
            if m is None:
                continue
            c = m['tte_classification']
            for g, vals in GROUPS.items():
                rows.append(dict(site=site, input=k, group=g, km2=np.isin(c, vals).sum() * res ** 2 / 1e6))
    return pd.DataFrame(rows)


# ---------------------------------------------------------------------------
# Figures
# ---------------------------------------------------------------------------
def plot_matrix(disp, sites, columns, labels, size_km, status=None, agree=None, kind='classes',
                panel=2.3, title=None):
    """Rows = sites, columns = inputs (reference first). kind: 'classes' or 'tcc'."""
    import matplotlib.pyplot as plt
    from matplotlib.colors import ListedColormap, BoundaryNorm, LinearSegmentedColormap
    from matplotlib.patches import Patch
    class_cmap = ListedColormap(tm.CLASS_COLORS)
    class_norm = BoundaryNorm(np.arange(0.5, 12.5), class_cmap.N)
    tcc_cmap = LinearSegmentedColormap.from_list('tcc', TCC_COLORS)
    status = status or {}
    agree_txt = {} if agree is None else {(r.site, r.input): r for r in agree.itertuples()}
    nr, nc = len(sites), len(columns)
    fig, axes = plt.subplots(nr, nc, figsize=(panel * nc + 0.8, panel * nr + 1.7), squeeze=False)
    for i, site in enumerate(sites):
        lon, lat = sites[site]
        ext = display_grid(lon, lat, size_km)['extent']
        for j, k in enumerate(columns):
            ax = axes[i, j]
            ax.set_xticks([]); ax.set_yticks([])
            if i == 0:
                ax.set_title(labels.get(k, k), fontsize=9)
            if j == 0:
                ax.set_ylabel(f'{site}\n{lon:.2f}, {lat:.2f}', fontsize=9)
            m = disp.get((site, k))
            if m is None:
                ax.set_facecolor('#f2f2f2')
                ax.set_xlim(ext[:2]); ax.set_ylim(ext[2:]); ax.set_aspect('equal')
                st = status.get((site, k), 'not run')
                if 'Earthdata' in st:
                    txt = 'needs Earthdata access\n(run the Earthdata login cell)'
                elif st.startswith('failed'):
                    txt = 'failed:\n' + st[8:48]
                else:
                    txt = st
                ax.text(0.5, 0.5, txt, ha='center', va='center', fontsize=7.5, color='0.35', transform=ax.transAxes)
                continue
            dom = np.where(np.isfinite(m['tte_domain']), 1.0, np.nan)
            ax.imshow(dom, extent=ext, cmap=ListedColormap([DOMAIN_COLOR]), interpolation='nearest')
            if kind == 'classes':
                ax.imshow(m['tte_classification'], extent=ext, cmap=class_cmap, norm=class_norm, interpolation='nearest')
                a = agree_txt.get((site, k))
                if k != 'reference' and a is not None:
                    ax.text(0.02, 0.02, f'same class {a.same_class:.0%}\noverlap {a.overlap:.0%}', transform=ax.transAxes,
                            fontsize=7, linespacing=1.1, bbox=dict(facecolor='white', alpha=0.85, lw=0, pad=1.5))
            else:
                ax.imshow(m['tcc_input'], extent=ext, cmap=tcc_cmap, vmin=0, vmax=50, interpolation='nearest')
    e = display_grid(*sites[list(sites)[0]], size_km)['extent']
    axes[0, 0].plot([e[0] + 1, e[0] + 6], [e[2] + 1.2] * 2, color='k', lw=2)
    axes[0, 0].text(e[0] + 3.5, e[2] + 1.8, '5 km', ha='center', fontsize=7)
    H = fig.get_figheight()
    if kind == 'classes':
        handles = [Patch(facecolor=c, edgecolor='0.5', lw=0.3, label=f'{v} {tm.CLASS_NAMES[v]}')
                   for v, c in zip(range(1, 12), tm.CLASS_COLORS)]
        handles.append(Patch(facecolor=DOMAIN_COLOR, label='TTE domain, not classified'))
        fig.legend(handles=handles, loc='lower center', ncol=4, fontsize=8, frameon=False)
    else:
        sm = plt.cm.ScalarMappable(cmap=tcc_cmap, norm=plt.Normalize(0, 50))
        cax = fig.add_axes([0.35, 0.35 / H, 0.3, 0.12 / H])
        fig.colorbar(sm, cax=cax, orientation='horizontal', label='tree canopy cover (%), inside the TTE domain')
    top = 0.35
    if title:
        fig.suptitle(title, fontsize=12, y=1 - 0.08 / H, va='top')   # fixed distance from the top, any figure height
    if kind == 'classes' and agree is not None:
        # what the two numbers in the lower left of each map mean
        fig.text(0.5, 1 - 0.36 / H,
                 'Lower left of each map, both compared with Ref. A (the GEE map): same class = of the pixels classified in both '
                 'maps, the share with the same TTE class;  overlap = pixels classified in both / pixels classified in either '
                 '(100 % = both maps classify exactly the same places).', ha='center', va='top', fontsize=8, wrap=True)
        top = 0.75
    fig.tight_layout(rect=(0, 1.15 / H, 1, 1 - top / H))
    fig.subplots_adjust(wspace=0.04, hspace=0.06)
    return fig


def plot_composition(disp, sites, columns, labels):
    """One panel per site: a bar per input, split by class share (class colors)."""
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(1, len(sites), figsize=(3.2 * len(sites), 0.35 * len(columns) + 1.6),
                             sharey=True, squeeze=False)
    for ax, site in zip(axes[0], sites):
        for y, k in enumerate(columns):
            m = disp.get((site, k))
            if m is None:
                continue
            c = m['tte_classification']
            n = np.bincount(c[np.isfinite(c)].astype(int), minlength=12)[1:12]
            ax.barh(y, n / max(n.sum(), 1), left=np.r_[0, np.cumsum(n / max(n.sum(), 1))[:-1]],
                    color=tm.CLASS_COLORS, height=0.8, edgecolor='none')
        ax.set_title(site, fontsize=10)
        ax.set_xlim(0, 1)
        ax.set_xlabel('share of classified pixels')
    axes[0, 0].set_yticks(range(len(columns)))
    axes[0, 0].set_yticklabels([labels.get(k, k).replace('\n', ' ') for k in columns], fontsize=8)
    axes[0, 0].invert_yaxis()
    fig.tight_layout()
    return fig
