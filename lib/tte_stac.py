"""
STAC metadata for TTE map tiles (lib/tte_map.py), for the MAAP DPS STAC catalog.

After a DPS job writes its COGs, `write_catalog` writes, in the job's output folder:

    catalog.json                       Catalog "DPS" (the file DPS watches for)
    tte_map/collection.json            Collection: title, description, license, citation
    tte_map/<item id>/<item id>.json   one Item per 1-degree tile COG (asset href relative: ../../tte_*.tif)

DPS ingestion then publishes the Items to the collection {username}__run_tte_map__{version}
(https://docs.maap-project.org/en/latest/technical_tutorials/dps_tutorial/dps_stac_metadata.html).
DPS fills in maap-dps:* (username, algorithm, tag), processing:version and created; they are not
written here.

Item id: tte_<tcc label>_<tile_num 7 digits>_<8-character signature of the run parameters>, so a
re-run with the same parameters replaces its item and a run with other parameters (tree cover
source, year, versions, options) adds a new one.

Each Item records how the tile was made (tree cover source and options, water, domain, GEE
emulation, code version), what is in the file (bands, units, nodata, class names and colors),
and a per-tile summary (domain and classified area, area per class, mean tree cover) for review maps.
"""
import hashlib
import json
import os
import subprocess
from datetime import datetime, timezone

import numpy as np
import pystac
import rasterio
from pystac.extensions.projection import ProjectionExtension
from pystac.extensions.raster import DataType, RasterBand, RasterExtension
from pystac.extensions.scientific import ScientificExtension
from shapely.geometry import mapping

import tte_map as tm

COLLECTION_ID = 'tte_map'        # local id; DPS publishes as {username}__run_tte_map__{version}
COLLECTION_TITLE = 'Taiga-tundra ecotone (TTE) forest structure pattern map'
COLLECTION_DESCRIPTION = (
    'Forest structure pattern classes of the circumpolar taiga-tundra ecotone, from the spatial pattern of '
    '30 m tree canopy cover (TCC) inside a bioclimatic TTE domain, following Montesano et al. (2020). '
    'Python port of the Google Earth Engine workflow that made TTE_DATA_v201902v2, run on MAAP DPS with '
    'any TCC input (item properties tte:tcc_source, tte:tcc_options). One item per 1-degree tile; 5-band COG on the original '
    'north polar Lambert azimuthal equal-area 30 m grid. Code: https://github.com/pahbs/tte')
LICENSE = 'CC-BY-4.0'
DOI = '10.1088/1748-9326/abb2c7'
CITATION = ('Montesano, P.M., Neigh, C.S.R., Macander, M., Feng, M., Noojipady, P. (2020). The bioclimatic '
            'extent and pattern of the cold edge of the boreal forest: the circumpolar taiga-tundra ecotone. '
            'Environmental Research Letters 15, 105019.')

BANDS = {   # name: (description, unit)
    'tte_domain': ('1 = inside the TTE domain: warmest-quarter mean temperature 7-14 C (WorldClim bio_10), '
                   'WWF taiga and tundra ecoregions, land', None),
    'tte_zones': ('Tree cover zone of classified pixels: 1 sparse (TCC > 0 to 5 %), 2 open (> 5 to 30 %), '
                  '3 intermediate & closed (> 30 %)', None),
    'tte_abruptness': ('Abruptness: normalized difference between the spatial rate of change in tree canopy '
                       'cover and the tree canopy cover, (rate - TCC) / (rate + TCC); -1 uniform to +1 abrupt', None),
    'tte_classification': ('TTE forest structure pattern class, 1-11 (see classification:classes)', None),
    'tcc': ('Input tree canopy cover where classified (water set to 0)', '%'),
}
PX_KM2 = tm.GRID_RES ** 2 / 1e6


def code_version():
    """git describe of the repo holding this file (the DPS clone is at the algorithm's tag)."""
    repo = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    try:
        return subprocess.run(['git', '-C', repo, 'describe', '--tags', '--always', '--dirty'],
                              capture_output=True, text=True, timeout=20).stdout.strip() or 'unknown'
    except Exception:
        return os.environ.get('TTE_CODE_VERSION', 'unknown')


def tile_summary(out, tcc, domain, inside):
    """Per-tile numbers for the item (areas in km2 on the equal-area grid)."""
    cls = out['tte_classification']
    dom = domain & inside
    n = {k: int(np.sum(cls == k)) for k in tm.CLASS_NAMES}
    n_cls = int(np.isfinite(cls).sum())
    with np.errstate(invalid='ignore'):
        mean_tcc = float(np.nanmean(np.where(dom, tcc, np.nan))) if dom.any() else None
        mean_abr = float(np.nanmean(out['tte_abruptness'])) if n_cls else None
    groups = {'sparse': [1, 2, 3, 4], 'open': [5, 6, 7, 8], 'intermediate_closed': [9], 'nonforest_edge': [10, 11]}
    return {
        'tte:domain_km2': round(int(dom.sum()) * PX_KM2, 2),
        'tte:classified_km2': round(n_cls * PX_KM2, 2),
        'tte:classified_share_of_domain': round(n_cls / dom.sum(), 4) if dom.any() else None,
        'tte:mean_tcc_domain': None if mean_tcc is None or not np.isfinite(mean_tcc) else round(mean_tcc, 2),
        'tte:mean_abruptness': None if mean_abr is None or not np.isfinite(mean_abr) else round(mean_abr, 3),
        'tte:class_km2': {tm.CLASS_NAMES[k]: round(v * PX_KM2, 2) for k, v in n.items()},
        'tte:group_share': {g: (round(sum(n[k] for k in ks) / n_cls, 4) if n_cls else None) for g, ks in groups.items()},
    }


def run_properties(tile_num, tcc_source, tcc_label, tcc_year, tcc_options, tcc_paths, gsw_version,
                   domain_path, emulate_gee):
    """How the tile was made. These (except the code version) make the item id signature."""
    import tte_tcc_sources as ts
    p = {
        'tte:tile_num': int(tile_num),
        'tte:tcc_source': tcc_source,
        'tte:tcc_label': tcc_label,
        'tte:tcc_year': int(tcc_year),
        'tte:tcc_options': ts.parse_options(tcc_options),
        'tte:tcc_description': ts.tcc_description(tcc_source, tcc_year, tcc_options),
        'tte:gee_pyramid_emulation': bool(emulate_gee),
        'tte:water': f'JRC Global Surface Water v{gsw_version} occurrence >= {tm.WATER_OCC_MIN} set to TCC 0',
        'tte:domain': os.path.basename(str(domain_path)),
        'tte:zone_thresholds_pct': {'sparse_max': tm.SPARSE_MAX, 'open_max': tm.OPEN_MAX},
    }
    if tcc_paths:
        p['tte:tcc_paths'] = list(tcc_paths)
    return p


def signature(props):
    return hashlib.sha256(json.dumps(props, sort_keys=True, separators=(',', ':')).encode()).hexdigest()[:8]


def make_item(cog_path, geom_4326, run_props, summary):
    """One STAC Item for one tile COG. geom_4326: the 1-degree tile polygon (lon/lat), the data footprint."""
    item_id = f"tte_{run_props['tte:tcc_label']}_{run_props['tte:tile_num']:07d}_{signature(run_props)}"
    year = run_props['tte:tcc_year']
    props = {
        'title': f"TTE map, tile {run_props['tte:tile_num']}, {run_props['tte:tcc_label']}",
        'description': run_props.get('tte:tcc_description', ''),
        **run_props,
        'tte:code_version': code_version(),
        'tte:method': 'Montesano et al. 2020 ERL 15:105019; Python port of GEE TTE_DATA_v201902v2 (lib/tte_map.py)',
        **summary,
    }
    item = pystac.Item(id=item_id, geometry=mapping(geom_4326), bbox=list(geom_4326.bounds),
                       datetime=datetime(year, 1, 1, tzinfo=timezone.utc), properties=props)

    with rasterio.open(cog_path) as src:
        names = list(src.descriptions)
        crs, shape, transform = src.crs, (src.height, src.width), src.transform
        bounds = list(src.bounds)
    proj = ProjectionExtension.ext(item, add_if_missing=True)
    proj.code = None
    proj.wkt2 = crs.to_wkt()
    proj.shape = list(shape)
    proj.transform = list(transform)[:6]
    proj.bbox = bounds

    sci = ScientificExtension.ext(item, add_if_missing=True)
    sci.doi = DOI
    sci.citation = CITATION

    asset = pystac.Asset(href=os.path.abspath(cog_path), media_type=pystac.MediaType.COG, roles=['data'],
                         title='TTE map tile (5-band COG)',
                         description='Bands: ' + ', '.join(names) + '. float32, NaN = no data or outside the tile.')
    bands_common, raster_bands = [], []
    for name in names:
        desc, unit = BANDS.get(name, ('', None))
        b = {'name': name, 'description': desc}
        if name == 'tte_classification':
            b['classification:classes'] = [
                {'value': k, 'name': f'class_{k}', 'description': tm.CLASS_NAMES[k],
                 'color_hint': tm.CLASS_COLORS[k - 1].lstrip('#').upper()} for k in tm.CLASS_NAMES]
        bands_common.append(b)
        rb = RasterBand.create(data_type=DataType.FLOAT32, nodata='nan', spatial_resolution=tm.GRID_RES)
        if unit:
            rb.unit = unit
        raster_bands.append(rb)
    asset.extra_fields['bands'] = bands_common
    item.add_asset('tte', asset)
    RasterExtension.ext(item.assets['tte'], add_if_missing=True).bands = raster_bands
    item.stac_extensions.append('https://stac-extensions.github.io/classification/v2.0.0/schema.json')
    return item


def make_collection(items):
    lons = [b for it in items for b in (it.bbox[0], it.bbox[2])]
    lats = [b for it in items for b in (it.bbox[1], it.bbox[3])]
    times = [it.datetime for it in items]
    col = pystac.Collection(
        id=COLLECTION_ID, title=COLLECTION_TITLE, description=COLLECTION_DESCRIPTION, license=LICENSE,
        extent=pystac.Extent(pystac.SpatialExtent([[min(lons), min(lats), max(lons), max(lats)]]),
                             pystac.TemporalExtent([[min(times), max(times)]])),
        keywords=['taiga-tundra ecotone', 'boreal forest', 'tree canopy cover', 'forest structure', 'arctic', 'MAAP'],
        providers=[pystac.Provider(name='NASA Goddard Space Flight Center', roles=['producer', 'processor'],
                                   url='https://github.com/pahbs/tte')])
    sci = ScientificExtension.ext(col, add_if_missing=True)
    sci.doi = DOI
    sci.citation = CITATION
    col.add_links([pystac.Link('cite-as', f'https://doi.org/{DOI}', title='Montesano et al. 2020, ERL'),
                   pystac.Link('license', 'https://creativecommons.org/licenses/by/4.0/', title='CC BY 4.0')])
    return col


def write_catalog(entries, out_dir, overwrite=False):
    """entries: list of dict(cog=path, geom=shapely lon/lat polygon, run_props=..., summary=...).
    Writes catalog.json + collection + items in out_dir (see module docstring). Returns item json paths."""
    out_dir = os.path.abspath(out_dir)
    cat_path = os.path.join(out_dir, 'catalog.json')
    if os.path.exists(cat_path) and not overwrite:
        raise FileExistsError(f'{cat_path} exists: use a fresh output folder (or overwrite=True)')
    items = [make_item(e['cog'], e['geom'], e['run_props'], e['summary']) for e in entries]
    col = make_collection(items)
    for it in items:
        col.add_item(it)
    cat = pystac.Catalog(id='DPS', description='TTE map tiles from DPS (run_tte_map)',
                         catalog_type=pystac.CatalogType.SELF_CONTAINED)
    cat.add_child(col)
    cat.normalize_hrefs(out_dir)
    cat.make_all_asset_hrefs_relative()
    for it in items:
        it.validate()
        json.dumps(it.to_dict(), allow_nan=False)       # strict JSON: no NaN/Infinity
    col.validate()
    cat.validate_all()
    cat.save(catalog_type=pystac.CatalogType.SELF_CONTAINED)
    return [it.get_self_href() for it in items]
