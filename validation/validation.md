# Python TTE map vs the GEE product (TTE_DATA_v201902v2)

Run 2026-11-23 on MAAP Hub: `lib/tte_map.py` with defaults (Hansen GFC 2018 v1.6, 2010; GSW v1.0;
GEE pyramid emulation on), then `tte/validate_tte_vs_gee.py`, which resamples each Python tile
(LAEA 30 m) onto the matching GEE download tile (EPSG:4326, nearest, as the GEE download did) and
compares pixels. Outputs and the CSV: `~/my-private-bucket/tte/test_python_vs_gee/`.

Columns:
* `domain_agree`: share of pixels where both agree on in/out of the TTE domain
* `class_mask_agree`: pixels classified in both / pixels classified in either
* `class_agree`: same class, among pixels classified in both
* `tcc_exact`: identical TCC value, among pixels with TCC in both
* `abr_mae`: mean absolute difference in abruptness (range -1 to 1)

| Site | Tile | Domain agree | Classified px GEE | Classified px Python | Class mask agree | Class agree | TCC exact | Abruptness MAE |
|---|---|---|---|---|---|---|---|---|
| Ob River | 4082 | 0.998 | 6,813,958 | 6,678,225 | 0.953 | 0.916 | 0.901 | 0.073 |
| Kola | 4357 | 0.999 | 11,691,448 | 11,669,656 | 0.987 | 0.935 | 0.905 | 0.055 |
| Kolyma | 4472 | 0.999 | 10,246,949 | 10,226,922 | 0.986 | 0.938 | 0.923 | 0.049 |
| Taymyr | 4996 | 0.998 | 3,827,985 | 3,805,438 | 0.957 | 0.918 | 0.935 | 0.063 |
| Lena | 600 | 0.999 | 4,710,889 | 4,705,666 | 0.975 | 0.934 | 0.951 | 0.044 |
| Pechora | 4379 | 0.999 | 7,059,727 | 7,022,140 | 0.951 | 0.903 | 0.920 | 0.073 |
| Chukotka | 4186 | 0.999 | 1,275,194 | 1,258,975 | 0.935 | 0.902 | 0.931 | 0.072 |
| Chukotka, -180 (domain VRT) | 4196 | 0.999 | 1,000,558 | 998,115 | 0.916 | 0.893 | 0.930 | 0.077 |
| Chukotka, -180 (domain VRT) | 3876 | 0.999 | 166,123 | 162,311 | 0.882 | 0.920 | 0.949 | 0.062 |
| Brooks Range | 4219 | 0.999 | 4,548,101 | 6,989,791 | 0.529 | 0.148 | 0.074 | 0.523 |
| Hudson Bay W | 7026 | 0.999 | 6,281,513 | 9,053,298 | 0.600 | 0.108 | 0.099 | 0.489 |
| NWT | 2997 | 0.996 | 2,586,625 | 5,547,840 | 0.363 | 0.209 | 0.185 | 0.502 |
| Quebec | 7034 | 0.995 | 950 | 7,896,871 | 0.000 | 0.256 | 0.282 | 0.740 |
| Labrador | 6817 | 0.998 | 263,524 | 533,835 | 0.231 | 0.183 | 0.179 | 0.622 |
| Mackenzie | 4540 | 0.997 | 4,605,445 | 8,545,702 | 0.520 | 0.061 | 0.053 | 0.663 |

(Most rows used each tile's own GEE `tte_domain` band as the domain; the domain VRT gives the same
result for Ob River: class agree 0.916. Tiles 4196 and 3876 test the antimeridian: the GEE download
wrote them at lon 180..181, and `domain_from_path` reads them with wrapped longitudes.)

## Reading the table

* **Eurasia reproduces**: 90-94% of pixels get the same class, 94-99% of classified pixels
  coincide. The input TCC matches 90-95%; the rest is GEE's own nearest-neighbour sampling of
  Hansen, which cannot be copied exactly (differences come in stripes that follow GEE's internal
  tiles). Disagreements are mostly between neighbouring classes (e.g. open diffuse-gradual vs
  diffuse-rapid) and at water edges (class 11).
* **North America does not, by design**: GEE used `cal_2m_tcc` (calibrated 2 m TCC) there, which
  the service account cannot read, and Python used Hansen 2010. Hansen classifies more pixels
  (more TCC > 0) and gives very different classes. This is the input effect, not the code.
  Quebec tile 7034 has only 950 classified pixels in GEE: `cal_2m_tcc` seems to be missing there.
* Without the GEE pyramid emulation, Ob River class agreement was 0.65 and TCC exact 0.21.

## To validate North America

Share `users/paulmontesano/tte_L7/cal_2010_2015/cal_2m_tcc` (read) with
`foreststructure@ee-paulmontesano.iam.gserviceaccount.com`, download it per tile with
`run_download_gee_tiles`, and run `tte_map.py --tcc_source path --tcc_paths <those tiles VRT>`.
