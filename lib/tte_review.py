"""
Review maps of TTE map tiles published in the MAAP DPS STAC catalog (see lib/tte_stac.py).

* items_gdf: the STAC items of a collection (one per tile) as a GeoDataFrame, with the per-tile
  metadata flattened into columns (for the tile grid rollover).
* register_search: a TiTiler-pgstac mosaic of those items (filtered by tree cover label, bbox).
* review_map: a folium map with TTE classes, domain, tree cover and abruptness layers from TiTiler,
  the tile grid with metadata on rollover, and a click query (class, TCC, abruptness, zone at the
  clicked pixel, from TiTiler's point endpoint).
"""
import json
import urllib.parse

import geopandas as gpd
import pandas as pd
import requests

import tte_map as tm

STAC_API = 'https://dps-stac.maap-project.org'
TITILER = 'https://titiler-dps-stac.maap-project.org'
BROWSER = 'https://dps-stac-browser.maap-project.org'
DOMAIN_COLOR = '#787878'
ZONE_NAMES = {1: 'sparse (0-5 %)', 2: 'open (5-30 %)', 3: 'intermediate & closed (> 30 %)'}

TOOLTIP_FIELDS = {    # column: label in the rollover
    'tile_num': 'tile', 'tcc_label': 'tree cover', 'tcc_year': 'year', 'tcc_description': 'source',
    'classified_km2': 'classified km²', 'domain_km2': 'TTE domain km²', 'classified_share_of_domain': 'classified / domain',
    'mean_tcc_domain': 'mean TCC in domain (%)', 'mean_abruptness': 'mean abruptness',
    'share_sparse': 'share sparse (1-4)', 'share_open': 'share open (5-8)',
    'share_intermediate_closed': 'share int. & closed (9)', 'share_nonforest_edge': 'share non-forest edge (10-11)',
    'code_version': 'code', 'maap-dps:tag': 'job tag', 'created': 'created', 'id': 'STAC item',
}


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
            elif k.startswith('tte:') and not isinstance(v, (dict, list)):
                row[k[4:]] = v
            elif k in ('maap-dps:tag', 'created', 'datetime'):
                row[k] = str(v)
        rows.append(row)
    if not rows:
        return gpd.GeoDataFrame(columns=['id', 'geometry'], geometry='geometry', crs=4326)
    return gpd.GeoDataFrame.from_features(
        [{'type': 'Feature', 'geometry': r.pop('geometry'), 'properties': r} for r in rows], crs=4326)


def register_search(collection, bbox=None, tcc_label=None):
    """Register a TiTiler-pgstac search (mosaic) and return its id."""
    body = {'collections': [collection], 'filter-lang': 'cql2-json'}
    if bbox:
        body['bbox'] = list(bbox)
    f = label_filter(tcc_label)
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
            '<div style="margin-top:4px;color:#555">Click the map for pixel values;<br>hover a tile for its metadata.</div></div>')


def _click_js(map_name, search_id, asset):
    """Leaflet click handler: query TiTiler's point endpoint for all bands and show a popup."""
    point = f'{TITILER}/searches/{search_id}/point/{{lon}},{{lat}}?assets={asset}'
    return f"""
    (function() {{
      var map = {map_name};
      var classNames = {json.dumps({str(k): v for k, v in tm.CLASS_NAMES.items()})};
      var classColors = {json.dumps({str(k): c for k, c in zip(tm.CLASS_NAMES, tm.CLASS_COLORS)})};
      var zoneNames = {json.dumps({str(k): v for k, v in ZONE_NAMES.items()})};
      var fmt = function(v, d) {{ return (v === null || v === undefined || isNaN(v)) ? '-' : Number(v).toFixed(d); }};
      map.on('click', function(e) {{
        var lon = e.latlng.lng.toFixed(5), lat = e.latlng.lat.toFixed(5);
        var url = '{point}'.replace('{{lon}}', lon).replace('{{lat}}', lat);
        var popup = L.popup().setLatLng(e.latlng).setContent('querying ' + lon + ', ' + lat + ' ...').openOn(map);
        fetch(url).then(function(r) {{ return r.text(); }}).then(function(t) {{
          var d = JSON.parse(t.replace(/\\bNaN\\b/g, 'null').replace(/-?Infinity/g, 'null'));
          var hit = null;
          (d.assets || []).forEach(function(a) {{
            var v = a.values || [];
            if (hit === null && v.length >= 5 && v[0] !== null && !isNaN(v[0])) {{ hit = a; }}
          }});
          if (hit === null) {{ popup.setContent('<b>' + lon + ', ' + lat + '</b><br>outside the TTE domain or no tile'); return; }}
          var v = hit.values, cls = (v[3] === null || isNaN(v[3])) ? null : Math.round(v[3]);
          var zone = (v[1] === null || isNaN(v[1])) ? null : Math.round(v[1]);
          var html = '<b>' + lon + ', ' + lat + '</b><br>' +
            (cls === null ? 'TTE domain, not classified (TCC 0, no change nearby)'
                          : '<span style="background:' + classColors[cls] + ';padding:0 6px;border:1px solid #888">&nbsp;</span> ' +
                            'class ' + cls + ': <b>' + classNames[cls] + '</b>') +
            '<br>tree cover: ' + fmt(v[4], 0) + ' %' +
            '<br>abruptness: ' + fmt(v[2], 3) +
            '<br>zone: ' + (zone === null ? '-' : zoneNames[zone]) +
            '<br><span style="color:#777">' + hit.name.split('/').pop() + '</span>';
          popup.setContent(html);
        }}).catch(function(err) {{ popup.setContent('query failed: ' + err); }});
      }});
    }})();
    """


def review_map(search_id, grid=None, asset='tte', center=None, zoom=6, min_zoom=5):
    """folium map: TTE classes (+ domain, TCC, abruptness), tile grid rollover, click query."""
    import folium
    from branca.element import Element
    m = folium.Map(location=center or [67, -155], zoom_start=zoom, tiles=None, control_scale=True)
    folium.TileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                     attr='Esri World Imagery', name='Esri World Imagery').add_to(m)
    folium.TileLayer('cartodbpositron', name='CartoDB Positron').add_to(m)
    common = dict(attr='TTE map tiles: MAAP DPS STAC / TiTiler', min_zoom=min_zoom, max_zoom=14)
    folium.TileLayer(tile_url(search_id, asset, 1, colormap=json.dumps({'1': DOMAIN_COLOR})),
                     name='TTE domain', opacity=0.6, overlay=True, **common).add_to(m)
    folium.TileLayer(tile_url(search_id, asset, 5, rescale='0,50', colormap_name='ylgn'),
                     name='Tree canopy cover (0-50 %)', overlay=True, show=False, **common).add_to(m)
    folium.TileLayer(tile_url(search_id, asset, 3, rescale='-1,1', colormap_name='rdylbu_r'),
                     name='Abruptness (-1 uniform to +1 abrupt)', overlay=True, show=False, **common).add_to(m)
    folium.TileLayer(tile_url(search_id, asset, 4, colormap=class_colormap()),
                     name='TTE classes', overlay=True, **common).add_to(m)
    if grid is not None and len(grid):
        fields = [c for c in TOOLTIP_FIELDS if c in grid.columns]
        g = grid[fields + ['geometry']].copy()
        for c in fields:
            if g[c].dtype == float:
                g[c] = g[c].round(3)
            g[c] = g[c].astype(str)
        folium.GeoJson(g, name='Tile grid (hover for metadata)',
                       style_function=lambda f: {'color': '#222', 'weight': 1, 'fillOpacity': 0.0},
                       highlight_function=lambda f: {'color': '#00e5ff', 'weight': 3},
                       tooltip=folium.GeoJsonTooltip(fields=fields, aliases=[TOOLTIP_FIELDS[c] for c in fields],
                                                     sticky=True, style='font-size:11px')).add_to(m)
        b = grid.total_bounds
        m.fit_bounds([[b[1], b[0]], [b[3], b[2]]])
    folium.LayerControl(collapsed=False).add_to(m)
    m.get_root().html.add_child(Element(_legend_html()))
    m.add_child(_Script(_click_js(m.get_name(), search_id, asset)))    # runs after the map is defined
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
