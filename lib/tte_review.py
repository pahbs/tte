"""
Review maps of TTE map tiles published in the MAAP DPS STAC catalog (see lib/tte_stac.py).

* published_runs: one row per run published so far (collection, run label, tree cover source,
  year, options, number of tiles, job tags, dates), to choose what to map.
* review_map: a folium map of the chosen runs, each with its own layers (TTE classes, tree cover,
  abruptness, tile grid with STAC metadata on rollover), from TiTiler-pgstac; clicking a pixel
  shows its class, TCC, abruptness and zone for every chosen run.
* Zoomed out (below zoom 5) TiTiler is too slow to mosaic thousands of tiles, so classes and tree
  cover come from a 1 km overview COG per run (lib/tte_overview.py; build_overviews(show)).
"""
import json
import os
import urllib.parse

import geopandas as gpd
import pandas as pd
import requests

import tte_map as tm

STAC_API = 'https://dps-stac.maap-project.org'
TITILER = 'https://titiler-dps-stac.maap-project.org'
BROWSER = 'https://dps-stac-browser.maap-project.org'
DOMAIN_COLOR = '#787878'
ZONE_NAMES = {1: 'sparse (0-5 %)', 2: 'open (5-30 %)', 3: 'intermediate & closed (> 30 %)',
              4: 'intermediate & closed (> 30 %, low TCC error; GEE map)'}

TOOLTIP_FIELDS = {    # column: label in the rollover
    'tile_num': 'tile', 'tcc_label': 'run', 'tcc_year': 'year', 'tcc_description': 'tree cover',
    'classified_km2': 'classified km²', 'domain_km2': 'TTE domain km²', 'classified_share_of_domain': 'classified / domain',
    'mean_tcc_domain': 'mean TCC in domain (%)', 'mean_abruptness': 'mean abruptness',
    'share_sparse': 'share sparse (1-4)', 'share_open': 'share open (5-8)',
    'share_intermediate_closed': 'share int. & closed (9)', 'share_nonforest_edge': 'share non-forest edge (10-11)',
    'code_version': 'code', 'maap-dps:tag': 'job tag', 'created': 'created', 'id': 'STAC item',
}


def find_collections(user='montesano', algorithm='run_tte_map', version=None):
    """DPS STAC collections of an algorithm. DPS publishes to {user}__<deployed name>__{version}, and the
    deployed name can carry a suffix added by MAAP (e.g. montesano__run_tte_map_13__tte_map_v1.1)."""
    r = requests.get(f'{STAC_API}/collections', params={'limit': 1000}, timeout=60)
    r.raise_for_status()
    ids = [c['id'] for c in r.json().get('collections', []) if c['id'].startswith(f'{user}__{algorithm}')]
    return sorted(i for i in ids if version is None or i.endswith(f'__{version}'))


REFERENCE_TAG = 'tte_data_v201902v2_reference'    # DPS job tag used when publishing the reference
REFERENCE_NAME = 'Reference c2010 (GEE)'


def find_reference(user='montesano', tag=REFERENCE_TAG):
    """The original c2010 map (GEE TTE_DATA_v201902v2 download tiles) published in the DPS STAC by MAAP's
    DPS STAC Item Generator (generate_stac_items) with job tag `tag` (see dps/DPS_tte_map.ipynb).
    Also its 1 km overview (tte_overview.build_reference_overview()), which maps it zoomed out, or at
    every zoom while the full-resolution tiles are not published.
    Returns dict(collection, tag, asset, overview), without the keys of what does not exist, or None."""
    from pystac_client import Client
    import tte_overview as ov
    ref = {}
    client = Client.open(STAC_API)
    for col in find_collections(user, 'generate_stac_items'):
        hit = next(client.search(collections=[col], max_items=1, filter_lang='cql2-json',
                                 filter={'op': '=', 'args': [{'property': 'maap-dps:tag'}, tag]}).items(), None)
        if hit is not None:
            ref = dict(collection=col, tag=tag, asset=next(iter(hit.assets)))
            break
    if os.path.exists(ov.overview_path(ov.REFERENCE_NAME)):
        ref['overview'] = ov.overview_s3(ov.REFERENCE_NAME)
    return ref or None


def label_filter(tcc_label=None):
    return None if not tcc_label else {'op': '=', 'args': [{'property': 'tte:tcc_label'}, tcc_label]}


def items_gdf(collection, bbox=None, tcc_label=None, max_items=5000):
    """STAC items of a collection as a GeoDataFrame (EPSG:4326); nested tte: fields flattened."""
    from pystac_client import Client
    search = Client.open(STAC_API).search(collections=[collection], bbox=bbox, filter=label_filter(tcc_label),
                                          filter_lang='cql2-json' if tcc_label else None, max_items=max_items)
    rows = []
    for it in search.items():
        p = it.properties
        row = {'id': it.id, 'geometry': it.geometry, 'href': it.assets['tte'].href if 'tte' in it.assets else None}
        for k, v in p.items():
            if k == 'tte:group_share':
                row.update({f'share_{g}': s for g, s in (v or {}).items()})
            elif k == 'tte:tcc_options':
                row['tcc_options'] = ';'.join(f'{a}={b}' for a, b in (v or {}).items()) or 'none'
            elif k.startswith('tte:') and not isinstance(v, (dict, list)):
                row[k[4:]] = v
            elif k in ('maap-dps:tag', 'created', 'datetime'):
                row[k] = str(v)
        rows.append(row)
    if not rows:
        return gpd.GeoDataFrame(columns=['id', 'geometry'], geometry='geometry', crs=4326)
    return gpd.GeoDataFrame.from_features(
        [{'type': 'Feature', 'geometry': r.pop('geometry'), 'properties': r} for r in rows], crs=4326)


def register_search(collection, bbox=None, tcc_label=None, tag=None):
    """Register a TiTiler-pgstac search (mosaic) and return its id. tag: DPS job tag (maap-dps:tag)."""
    body = {'collections': [collection], 'filter-lang': 'cql2-json'}
    if bbox:
        body['bbox'] = list(bbox)
    f = label_filter(tcc_label) or ({'op': '=', 'args': [{'property': 'maap-dps:tag'}, tag]} if tag else None)
    if f:
        body['filter'] = f
    r = requests.post(f'{TITILER}/searches/register', json=body, timeout=60)
    r.raise_for_status()
    return r.json()['id']


def tile_url(search_id, asset='tte', band=4, **params):
    """XYZ template for one band of the mosaic. Band goes in `assets` (asset|bidx=N) on this TiTiler."""
    q = {'assets': f'{asset}|bidx={band}', **params}
    return (f'{TITILER}/searches/{search_id}/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}.png?'
            + urllib.parse.urlencode(q, quote_via=urllib.parse.quote))


def class_colormap():
    return json.dumps({str(k): c for k, c in zip(tm.CLASS_NAMES, tm.CLASS_COLORS)})


def _legend_html():
    rows = ''.join(f'<div><span style="background:{c};width:12px;height:12px;display:inline-block;'
                   f'border:1px solid #888;margin-right:5px"></span>{k} {tm.CLASS_NAMES[k]}</div>'
                   for k, c in zip(tm.CLASS_NAMES, tm.CLASS_COLORS))
    rows += (f'<div><span style="background:{DOMAIN_COLOR};width:12px;height:12px;display:inline-block;'
             f'margin-right:5px"></span>TTE domain, not classified</div>')
    return ('<div style="position:fixed;bottom:25px;left:10px;z-index:9999;background:white;padding:6px 8px;'
            'font-size:11px;border:1px solid #999;border-radius:4px;line-height:15px">'
            '<b>TTE forest structure pattern</b>' + rows +
            '<div style="margin-top:4px;color:#555">Zoomed out (below zoom 5), classes and tree<br>cover come from 1 km overviews;'
            ' abruptness<br>draws from zoom 5. Click the map for pixel values;'
            '<br>hover a tile for its metadata.</div></div>')


def published_runs(user='montesano', algorithm='run_tte_map', bbox=None):
    """One row per run (collection x tte:tcc_label) published so far, newest first."""
    rows = []
    for col in find_collections(user, algorithm):
        g = items_gdf(col, bbox=bbox)
        if not len(g) or 'tcc_label' not in g:
            continue
        for label, d in g.groupby('tcc_label'):
            first = lambda c: d[c].iloc[0] if c in d else None
            rows.append(dict(collection=col, version=col.rsplit('__', 1)[-1], run=label,
                             tcc_source=first('tcc_source'), tcc_year=first('tcc_year'),
                             tcc_options=first('tcc_options'), tiles=len(d),
                             job_tags=', '.join(sorted(set(d['maap-dps:tag'].dropna()))) if 'maap-dps:tag' in d else '',
                             extent=', '.join(f'{v:.0f}' for v in d.total_bounds),
                             first_created=str(d['created'].min())[:16] if 'created' in d else '',
                             last_created=str(d['created'].max())[:16] if 'created' in d else ''))
    cols = ['collection', 'version', 'run', 'tcc_source', 'tcc_year', 'tcc_options', 'tiles', 'extent',
            'job_tags', 'first_created', 'last_created']
    return pd.DataFrame(rows, columns=cols).sort_values('last_created', ascending=False, ignore_index=True)


def _click_js(map_name, runs, asset):
    """Leaflet click handler: query TiTiler's point endpoint for every run and show them in one popup."""
    targets = [{'name': r['name'],
                'url': f"{TITILER}/searches/{r['search_id']}/point/{{lon}},{{lat}}?assets={r.get('asset', asset)}"}
               for r in runs]
    return f"""
    (function() {{
      var map = {map_name};
      var runs = {json.dumps(targets)};
      var classNames = {json.dumps({str(k): v for k, v in tm.CLASS_NAMES.items()})};
      var classColors = {json.dumps({str(k): c for k, c in zip(tm.CLASS_NAMES, tm.CLASS_COLORS)})};
      var zoneNames = {json.dumps({str(k): v for k, v in ZONE_NAMES.items()})};
      var fmt = function(v, d) {{ return (v === null || v === undefined || isNaN(v)) ? '-' : Number(v).toFixed(d); }};
      var one = function(run, t) {{
        if (!t || !t.trim()) {{ return '<b>' + run.name + '</b>: no tile here'; }}
        var d = JSON.parse(t.replace(/\\bNaN\\b/g, 'null').replace(/-?Infinity/g, 'null'));
        var hit = null;
        (d.assets || []).forEach(function(a) {{
          var v = a.values || [];
          if (hit === null && v.length >= 5 && v[0] !== null && !isNaN(v[0])) {{ hit = a; }}
        }});
        var head = '<b>' + run.name + '</b>: ';
        if (hit === null) {{ return head + 'outside the TTE domain or no tile'; }}
        var v = hit.values, cls = (v[3] === null || isNaN(v[3])) ? null : Math.round(v[3]);
        var zone = (v[1] === null || isNaN(v[1])) ? null : Math.round(v[1]);
        return head + (cls === null ? 'TTE domain, not classified (TCC 0, no change nearby)'
                     : '<span style="background:' + classColors[cls] + ';padding:0 6px;border:1px solid #888">&nbsp;</span> '
                       + cls + ' ' + classNames[cls])
          + '<br>&nbsp;&nbsp;TCC ' + fmt(v[4], 0) + ' %, abruptness ' + fmt(v[2], 3)
          + ', zone ' + (zone === null ? '-' : zoneNames[zone]);
      }};
      map.on('click', function(e) {{
        var lon = e.latlng.lng.toFixed(5), lat = e.latlng.lat.toFixed(5);
        var popup = L.popup({{maxWidth: 420}}).setLatLng(e.latlng).setContent('querying ' + lon + ', ' + lat + ' ...').openOn(map);
        Promise.all(runs.map(function(run) {{
          var url = run.url.replace('{{lon}}', lon).replace('{{lat}}', lat);
          return fetch(url).then(function(r) {{ return r.text(); }}).then(function(t) {{ return one(run, t); }})
                           .catch(function(err) {{ return '<b>' + run.name + '</b>: query failed (' + err + ')'; }});
        }})).then(function(parts) {{
          popup.setContent('<b>' + lon + ', ' + lat + '</b><br>' + parts.join('<br>'));
        }});
      }});
    }})();
    """


ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/{}/MapServer/tile/{{z}}/{{y}}/{{x}}'
BASEMAPS = [   # (name, Esri service, highest zoom with tiles, attribution); the first is shown when the map opens
    ('Esri Light Gray Canvas', 'Canvas/World_Light_Gray_Base', 16,
     'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS user community'),
    ('Esri National Geographic', 'NatGeo_World_Map', 16,
     'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC'),
    ('Esri Shaded Relief (hillshade, land/water)', 'World_Shaded_Relief', 13, 'Tiles &copy; Esri &mdash; Source: Esri'),
    ('Esri World Imagery', 'World_Imagery', 19,
     'Tiles &copy; Esri &mdash; Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community'),
]


def add_basemaps(m):
    """Esri basemaps as base layers; zooms beyond a service's last level enlarge its tiles."""
    import folium
    for i, (name, service, native, attr) in enumerate(BASEMAPS):
        folium.TileLayer(ESRI.format(service), attr=attr, name=name, max_native_zoom=native, max_zoom=18,
                         show=i == 0).add_to(m)


def cog_tile_url(url, band, **params):
    """XYZ template for one band of a single COG (TiTiler /cog), e.g. an overview."""
    q = {'url': url, 'bidx': band, **params}
    return (f'{TITILER}/cog/tiles/WebMercatorQuad/{{z}}/{{x}}/{{y}}.png?'
            + urllib.parse.urlencode(q, quote_via=urllib.parse.quote))


def run_overview(collection, label):
    """(s3 url, number of tiles it was built from) of a run's 1 km overview, or (None, 0)."""
    import rasterio
    import tte_overview as ov
    path = ov.overview_path(ov.overview_name(collection, label))
    if not os.path.exists(path):
        return None, 0
    with rasterio.open(path) as src:
        n = int(src.tags().get('source_tiles', 0))
    return ov.overview_s3(ov.overview_name(collection, label)), n


def build_overviews(show, rebuild=False):
    """Build the 1 km overview of each (collection, run label) in `show` that has none, or that has fewer
    tiles than the run has published now (rebuild=True: all of them). About 0.3 s per tile on the Hub."""
    import tte_overview as ov
    for col, label in show:
        _, n = run_overview(col, label)
        now = len(items_gdf(col, tcc_label=label))
        if rebuild or n < now:
            print(f'{label}: overview has {n} tiles, the run has {now}: building')
            ov.build_run_overview(col, label)
        else:
            print(f'{label}: overview up to date ({n} tiles)')


def _layer(m, name, show, detail=None, overview=None, min_zoom=5, opacity=1.0):
    """One switchable layer: TiTiler mosaic tiles from min_zoom in, and the 1 km overview below min_zoom
    (or at every zoom when there are no mosaic tiles)."""
    import folium
    g = folium.FeatureGroup(name=name, show=show, overlay=True)
    attr = 'TTE map tiles: MAAP DPS STAC / TiTiler'
    if detail:
        folium.TileLayer(detail, attr=attr, min_zoom=min_zoom, max_zoom=18, max_native_zoom=14,
                         opacity=opacity).add_to(g)
    if overview:
        folium.TileLayer(overview, attr=attr, min_zoom=0, max_zoom=(min_zoom - 1) if detail else 18,
                         opacity=opacity).add_to(g)
    g.add_to(m)
    return g


def review_map(show, bbox=None, reference=None, asset='tte', zoom=6, min_zoom=5):
    """folium map of the runs in `show`, a list of (collection, run label) pairs (see published_runs).
    Each run gets its own layers; the first run's classes and tile grid are switched on.
    bbox: lon/lat box (W, S, E, N) to limit the tiles, or None for all published tiles of the runs.
    reference: the original c2010 map (find_reference()), added as its own layers and in the click query."""
    import folium
    from branca.element import Element
    runs = []
    versions = {c.rsplit('__', 1)[-1] for c, _ in show}
    for col, label in show:
        grid = items_gdf(col, bbox=bbox, tcc_label=label)
        if not len(grid):
            print(f'{col} / {label}: no tiles' + (' in this region' if bbox else ''))
            continue
        name = label if len(versions) == 1 else f"{label} ({col.rsplit('__', 1)[-1]})"
        ov_url, ov_n = run_overview(col, label)
        runs.append(dict(name=name, collection=col, label=label, grid=grid, overview=ov_url,
                         search_id=register_search(col, bbox=bbox, tcc_label=label)))
        print(f'{name}: {len(grid)} tiles from {col}')
        if not ov_url:
            print(f'  no overview yet, so it shows only from zoom {min_zoom}: tr.build_overviews(SHOW)')
        elif bbox is None and ov_n < len(grid):
            print(f'  overview has {ov_n} of its {len(grid)} tiles: tr.build_overviews(SHOW) to update it')
    m = folium.Map(location=[67, -155], zoom_start=zoom, tiles=None, control_scale=True)
    add_basemaps(m)
    ref = None
    if reference:
        ref = dict(name=REFERENCE_NAME, asset=reference.get('asset'), overview=reference.get('overview'),
                   search_id=None)
        if reference.get('collection'):
            ref['search_id'] = register_search(reference['collection'], bbox=bbox, tag=reference['tag'])
            print(f"{REFERENCE_NAME}: items tagged {reference['tag']} in {reference['collection']}")
        if ref['overview']:
            print(f"{REFERENCE_NAME}: 1 km overview" + ('' if ref['search_id'] else ' (at every zoom; '
                  'full resolution once published, see dps/DPS_tte_map.ipynb section 7)'))
    if not runs and not ref:
        return m

    def detail(r, band, **params):
        return tile_url(r['search_id'], r.get('asset') or asset, band, **params) if r['search_id'] else None

    def coarse(r, band, **params):          # overview bands: 1 domain, 2 classes, 3 tcc
        return cog_tile_url(r['overview'], band, **params) if r['overview'] else None

    dom = runs[0] if runs else ref
    cm_dom = json.dumps({'1': DOMAIN_COLOR})
    _layer(m, 'TTE domain', True, detail(dom, 1, colormap=cm_dom), coarse(dom, 1, colormap=cm_dom), min_zoom,
           opacity=0.6)
    tcc_kw, cls_kw = dict(rescale='0,50', colormap_name='ylgn'), dict(colormap=class_colormap())
    if ref:
        _layer(m, f'{REFERENCE_NAME}: tree canopy cover (0-50 %)', False,
               detail(ref, 5, **tcc_kw), coarse(ref, 3, **tcc_kw), min_zoom)
        _layer(m, f'{REFERENCE_NAME}: TTE classes', not runs,
               detail(ref, 4, **cls_kw), coarse(ref, 2, **cls_kw), min_zoom)
    fields_all = list(TOOLTIP_FIELDS)
    for i, r in enumerate(runs):
        first = i == 0
        _layer(m, f"{r['name']}: tree canopy cover (0-50 %)", False,
               detail(r, 5, **tcc_kw), coarse(r, 3, **tcc_kw), min_zoom)
        _layer(m, f"{r['name']}: abruptness (-1 uniform to +1 abrupt)", False,
               detail(r, 3, rescale='-1,1', colormap_name='rdylbu_r'), None, min_zoom)
        _layer(m, f"{r['name']}: TTE classes", first, detail(r, 4, **cls_kw), coarse(r, 2, **cls_kw), min_zoom)
        fields = [c for c in fields_all if c in r['grid'].columns]
        g = r['grid'][fields + ['geometry']].copy()
        for c in fields:
            if g[c].dtype == float:
                g[c] = g[c].round(3)
            g[c] = g[c].astype(str)
        folium.GeoJson(g, name=f"{r['name']}: tile grid (hover for metadata)", show=first,
                       style_function=lambda f: {'color': '#222', 'weight': 1, 'fillOpacity': 0.0},
                       highlight_function=lambda f: {'color': '#00e5ff', 'weight': 3},
                       tooltip=folium.GeoJsonTooltip(fields=fields, aliases=[TOOLTIP_FIELDS[c] for c in fields],
                                                     sticky=True, style='font-size:11px')).add_to(m)
    # open on the first run's full extent (its classes are switched on). Without an overview its tiles only
    # draw from zoom min_zoom in, so if they are spread over a wide area, open on its most recent tile.
    g0 = runs[0]['grid'] if runs else None
    b = g0.total_bounds if runs else (bbox or (-180.0, 45.0, 180.0, 75.0))
    if runs and not runs[0]['overview'] and (b[2] - b[0] > 30 or b[3] - b[1] > 15):
        last = g0.sort_values('created').iloc[-1] if 'created' in g0 else g0.iloc[-1]
        b = last.geometry.bounds
        print(f"{runs[0]['name']} spreads over {g0.total_bounds.round(0).tolist()}: opening on tile {last.get('tile_num')}"
              ' (use REGION to focus on an area)')
    m.fit_bounds([[b[1], b[0]], [b[3], b[2]]])
    folium.LayerControl(collapsed=False).add_to(m)
    m.get_root().html.add_child(Element(_legend_html()))
    m.add_child(_Script(_click_js(m.get_name(), ([ref] if ref and ref['search_id'] else []) + runs, asset)))   # after the map is defined
    return m


def _script_class():
    from branca.element import MacroElement
    from jinja2 import Template

    class Script(MacroElement):
        _template = Template('{% macro script(this, kwargs) %}{{ this.js }}{% endmacro %}')

        def __init__(self, js):
            super().__init__()
            self._name = 'ClickQuery'
            self.js = js
    return Script


def _Script(js):
    return _script_class()(js)
