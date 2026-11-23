#!/bin/bash
# DPS run script for the taiga-tundra ecotone (TTE) map, one or more 1-degree tiles per job.
#
# Inputs, by name (OGC DPS passes --name value) or, for older DPS, by position in this order
# (use 'none' for an empty value):
#  1 tile_num        e.g. 4082 or 4082,4083                                             (required)
#  2 tcc_source      tree cover source name, see lib/tte_tcc_sources.py SOURCES          (required)
#  3 tcc_year        year the tree cover represents                                     (required)
#  4 tcc_options     source options 'key=value;key=value' (e.g. version=..., floor=5), or none
#  5 tcc_paths       comma-separated rasters/VRTs (s3://, https://) for tcc_source 'path', or none
#  6 out_name        label for the outputs (required for tcc_source 'path'), or none
#  7 gee_emulation   true | false  (read GSW water, and sources that support it, as GEE did)
#  8 domain_path     static TTE domain raster/VRT
#  9 tiles_gpkg      1-degree tile index with tile_num
# 10 write_stac      true | false  (write catalog.json + STAC items for the DPS STAC catalog)
set -x
basedir=$( cd "$(dirname "$0")" ; pwd -P )

# conda env: 'python' (base_images/python) or 'notebook' (custom_images/maap_base)
for e in python notebook; do
    if conda env list | awk '{print $1}' | grep -qx "$e"; then source activate "$e"; break; fi
done
unset PROJ_LIB

declare -A IN=(
    [tile_num]="" [tcc_source]="" [tcc_year]="" [tcc_options]=none [tcc_paths]=none [out_name]=none
    [gee_emulation]=true
    [domain_path]=s3://maap-ops-workspace/shared/montesano/tte/static/tte_domain_v201902v2.vrt
    [tiles_gpkg]=s3://maap-ops-workspace/shared/montesano/databank/tte_tiles.gpkg [write_stac]=true )
NAMES=(tile_num tcc_source tcc_year tcc_options tcc_paths out_name gee_emulation domain_path tiles_gpkg write_stac)

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
for r in tile_num tcc_source tcc_year; do
    [ -z "${IN[$r]}" ] && { echo "$r is required" >&2; exit 1; }
done

nz() { if [ "$1" == "none" ]; then echo ""; else echo "$1"; fi; }
OUTPUTDIR="${PWD}/output"
mkdir -p ${OUTPUTDIR}

ARGS=(--tile_num "${IN[tile_num]}" --tcc_source "${IN[tcc_source]}" --tcc_year "${IN[tcc_year]}"
      --tcc_options "$(nz "${IN[tcc_options]}")" --tcc_paths "$(nz "${IN[tcc_paths]}")"
      --domain_path "${IN[domain_path]}" --tiles_gpkg "${IN[tiles_gpkg]}" --outdir "${OUTPUTDIR}")
[ -n "$(nz "${IN[out_name]}")" ] && ARGS+=(--out_name "${IN[out_name]}")
[ "${IN[gee_emulation]}" == "false" ] && ARGS+=(--no_gee_emulation)
[ "${IN[write_stac]}" == "true" ] && ARGS+=(--write_stac)

python ${basedir}/../../lib/tte_map.py "${ARGS[@]}"
