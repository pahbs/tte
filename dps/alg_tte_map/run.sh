#!/bin/bash
# DPS run script for the taiga-tundra ecotone (TTE) map, one or more 1-degree tiles per job.
#
# Inputs, by name (OGC DPS passes --name value) or, for older DPS, by position in this order
# (use 'none' for an empty value):
#  1 tile_num          e.g. 4082 or 4082,4083
#  2 tcc_source        hansen | path | meta_chm
#  3 tcc_year          e.g. 2010 (hansen: loss before this year set to 0; others: nominal year)
#  4 hansen_version    e.g. GFC-2018-v1.6 (the GEE original) or GFC-2025-v1.13
#  5 tcc_paths         comma-separated rasters/VRTs (s3://, https://) when tcc_source=path, else none
#  6 tcc_scale         multiply input to get percent cover (e.g. 1, or 100 for fractions)
#  7 tcc_resampling    nearest | average | bilinear ...
#  8 out_name          label for output names when tcc_source=path, else none
#  9 gee_emulation     true | false  (read Hansen/GSW like GEE did: 2x2 pyramids north of 64.07N)
# 10 domain_path       static TTE domain raster/VRT
# 11 tiles_gpkg        1-degree tile index with tile_num
# 12 write_stac        true | false  (write catalog.json + STAC items for the DPS STAC catalog)
set -x
basedir=$( cd "$(dirname "$0")" ; pwd -P )

# conda env: 'python' (base_images/python) or 'notebook' (custom_images/maap_base)
for e in python notebook; do
    if conda env list | awk '{print $1}' | grep -qx "$e"; then source activate "$e"; break; fi
done
unset PROJ_LIB

declare -A IN=(
    [tile_num]="" [tcc_source]=hansen [tcc_year]=2010 [hansen_version]=GFC-2018-v1.6 [tcc_paths]=none
    [tcc_scale]=1 [tcc_resampling]=nearest [out_name]=none [gee_emulation]=true
    [domain_path]=s3://maap-ops-workspace/shared/montesano/tte/static/tte_domain_v201902v2.vrt
    [tiles_gpkg]=s3://maap-ops-workspace/shared/montesano/databank/tte_tiles.gpkg [write_stac]=true )
NAMES=(tile_num tcc_source tcc_year hansen_version tcc_paths tcc_scale tcc_resampling out_name
       gee_emulation domain_path tiles_gpkg write_stac)

if [[ "${1:-}" == --* ]]; then                      # named: --name value or --name=value
    while [ $# -gt 0 ]; do
        case "$1" in
            --*=*) k="${1%%=*}"; IN[${k#--}]="${1#*=}"; shift ;;
            --*)   if [[ $# -ge 2 && "$2" != --* ]]; then IN[${1#--}]="$2"; shift 2; else IN[${1#--}]=""; shift; fi ;;
            *)     echo "ignoring unexpected argument: $1" >&2; shift ;;
        esac
    done
else                                                 # positional (older DPS)
    i=1
    for n in "${NAMES[@]}"; do v="${!i:-}"; [ -n "$v" ] && IN[$n]="$v"; i=$((i + 1)); done
fi
[ -z "${IN[tile_num]}" ] && { echo "tile_num is required" >&2; exit 1; }

nz() { if [ "$1" == "none" ]; then echo ""; else echo "$1"; fi; }
OUTPUTDIR="${PWD}/output"
mkdir -p ${OUTPUTDIR}

ARGS="--tile_num ${IN[tile_num]} --tcc_source ${IN[tcc_source]} --tcc_year ${IN[tcc_year]}"
ARGS+=" --hansen_version ${IN[hansen_version]} --tcc_paths=$(nz ${IN[tcc_paths]})"
ARGS+=" --tcc_scale ${IN[tcc_scale]} --tcc_resampling ${IN[tcc_resampling]}"
[ -n "$(nz ${IN[out_name]})" ] && ARGS+=" --out_name ${IN[out_name]}"
[ "${IN[gee_emulation]}" == "false" ] && ARGS+=" --no_gee_emulation"
ARGS+=" --domain_path ${IN[domain_path]} --tiles_gpkg ${IN[tiles_gpkg]} --outdir ${OUTPUTDIR}"
[ "${IN[write_stac]}" == "true" ] && ARGS+=" --write_stac"

python ${basedir}/../../lib/tte_map.py ${ARGS}
