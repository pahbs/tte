#!/bin/bash
# DPS build for run_tte_map: adds the few packages tte_map.py needs to the base 'python' env.
set -x
basedir=$( cd "$(dirname "$0")" ; pwd -P )
conda env update -n python -f ${basedir}/env.yml --solver=libmamba
source activate python
python -c "import rasterio, geopandas, pyproj, shapely; print('rasterio', rasterio.__version__, 'gdal', rasterio.__gdal_version__)"
