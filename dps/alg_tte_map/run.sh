#!/bin/bash
# DPS run script for the taiga-tundra ecotone (TTE) map, one or more 1-degree tiles per job.
# Positional args (use 'none' for an empty value; DPS can drop empty strings):
#  1 tile_num          e.g. 4082 or 4082,4083
#  2 tcc_source        hansen | path
#  3 tcc_year          e.g. 2010 (hansen: loss before this year set to 0)
#  4 hansen_version    e.g. GFC-2018-v1.6 (the GEE original) or GFC-2024-v1.12
#  5 tcc_paths         comma-separated rasters/VRTs (s3://, https://) when tcc_source=path, else none
#  6 tcc_scale         multiply input to get percent cover (e.g. 1, or 100 for fractions)
#  7 tcc_resampling    nearest | average | bilinear ...
#  8 out_name          label for output names when tcc_source=path, else none
#  9 gee_emulation     true | false  (read Hansen/GSW like GEE did: 2x2 pyramids north of 64.07N)
# 10 domain_path       static TTE domain raster/VRT
# 11 tiles_gpkg        1-degree tile index with tile_num
# 12 write_stac        true | false  (write catalog.json + STAC items for the DPS STAC catalog)
set -x
source activate python
unset PROJ_LIB

basedir=$( cd "$(dirname "$0")" ; pwd -P )
OUTPUTDIR="${PWD}/output"
mkdir -p ${OUTPUTDIR}

nz() { if [ "$1" == "none" ]; then echo ""; else echo "$1"; fi; }

ARGS="--tile_num ${1} --tcc_source ${2} --tcc_year ${3} --hansen_version ${4}"
ARGS+=" --tcc_paths=$(nz ${5}) --tcc_scale ${6} --tcc_resampling ${7}"
[ -n "$(nz ${8})" ] && ARGS+=" --out_name ${8}"
[ "${9}" == "false" ] && ARGS+=" --no_gee_emulation"
ARGS+=" --domain_path ${10} --tiles_gpkg ${11} --outdir ${OUTPUTDIR}"
[ "${12:-true}" == "true" ] && ARGS+=" --write_stac"

python ${basedir}/../../lib/tte_map.py ${ARGS}
