#!/bin/bash
# DPS build script: add the TTE dependencies to the image's conda env
# ('python' in base_images/python, 'notebook' in custom_images/maap_base).
set -ex
basedir=$( cd "$(dirname "$0")" ; pwd -P )
ENV_NAME=base
for e in python notebook; do
    if conda env list | awk '{print $1}' | grep -qx "$e"; then ENV_NAME=$e; break; fi
done
conda env update -n ${ENV_NAME} -f ${basedir}/env.yml --solver=libmamba || conda env update -n ${ENV_NAME} -f ${basedir}/env.yml
