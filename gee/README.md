# Original Google Earth Engine scripts (TTE map, circa 2010)

Copied unchanged from the Earth Engine script repos, cloned 2026-11-23 on MAAP Hub at `~/code/gee`:

| File here | GEE repo path | Last commit |
|---|---|---|
| `TTE_map_working.js` | `users/paulmontesano/default:TTE/TTE _map_working` | `0abdec7` 2023-06-10 |
| `TTE_map.js` | `users/paulmontesano/default:TTE/TTE_map` | (same repo) |
| `TTE_map_publish.js` | `users/paulmontesano/default:TTE/TTE_map_publish` | (same repo) |
| `TTE_classification.js` | `users/paulmontesano/default:TTE/TTE_classification` | (same repo) |
| `mod_forest_structure.js` | `users/paulmontesano/montesano:mod_forest_structure.js` | `9667f10` 2021-11-18 |
| `mod_landform.js` | `users/paulmontesano/montesano:mod_landform.js` | (same repo) |

- `TTE_map_working.js` builds the map and exports `TTE_DATA_v20190<num_month>v2`
  (`num_month = 2`: calibrated 2 m TCC in North America, Hansen 2010 in Eurasia).
  This is the script ported to `lib/tte_map.py`.
- `get_abruptness()` in `mod_forest_structure.js` is the abruptness calculation.
- `TTE_map.js` uses the exported `TTE_DATA` assets for area, covariate and landform analyses.
- `TTE_map_publish.js` / `TTE_classification.js` display the published map.

The exported asset `projects/foreststructure/TTE_DATA_v201902v2` is on a north polar
Lambert azimuthal equal-area grid (lat_0 90, lon_0 0, WGS84), 30 m, origin
(-4889349.355797417, 4889344.677898709), inherited from Feng et al.'s TCC error layer.
