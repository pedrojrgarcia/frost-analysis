import argparse
import json
import math
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.merge import merge
from shapely.geometry import box

OUT_FILE = Path("data") / "terrain.json"
COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]


def compass_name(degrees):
    return COMPASS[int(round(degrees / 45.0)) % 8]


def merge_tiles(dem_dir):
    """Merge all GeoTIFF tiles in dem_dir. Returns (elevation array with NaN, transform, crs, tile names)."""
    paths = sorted(p for p in Path(dem_dir).iterdir() if p.suffix.lower() in (".tif", ".tiff"))
    if not paths:
        sys.exit(f"No GeoTIFF tiles found in {dem_dir}.")
    sources = [rasterio.open(p) for p in paths]
    try:
        mosaic, transform = merge(sources)
        crs = sources[0].crs
        nodata = sources[0].nodata
    finally:
        for s in sources:
            s.close()
    elevation = mosaic[0].astype("float64")
    if nodata is not None:
        elevation[elevation == nodata] = np.nan
    return elevation, transform, crs, [p.name for p in paths]


def slope_and_aspect(elevation, transform):
    """Slope (radians) and downslope direction (compass degrees, NaN on flat cells) per cell."""
    xres, yres = transform.a, -transform.e
    d_row, d_col = np.gradient(elevation)
    dz_east = d_col / xres
    dz_north = -d_row / yres  # rows run from north to south
    slope = np.arctan(np.hypot(dz_east, dz_north))
    aspect = np.degrees(np.arctan2(-dz_east, -dz_north)) % 360
    aspect[(dz_east == 0) & (dz_north == 0)] = np.nan
    return slope, aspect


def circular_mean_degrees(angles):
    angles = angles[~np.isnan(angles)]
    if angles.size == 0:
        return None
    rad = np.radians(angles)
    return math.degrees(math.atan2(np.sin(rad).mean(), np.cos(rad).mean())) % 360


def main():
    parser = argparse.ArgumentParser(description="Compute terrain characteristics of a plot from DGM1 tiles.")
    parser.add_argument("--plot", default="data/Weinbergsflaeche_Kroev.shp", help="Shapefile of the plot")
    parser.add_argument("--dem", default="data/dgm1", help="Folder with the DGM1 GeoTIFF tiles")
    args = parser.parse_args()

    elevation, transform, crs, tiles = merge_tiles(args.dem)

    plot = gpd.read_file(args.plot).to_crs(crs)
    geometry = plot.geometry.union_all() if hasattr(plot.geometry, "union_all") else plot.geometry.unary_union

    height, width = elevation.shape
    bounds = rasterio.transform.array_bounds(height, width, transform)
    if not box(*bounds).contains(geometry):
        sys.exit(f"The plot is not fully covered by the tiles in {args.dem}. Download the missing DGM1 tiles.")

    slope, aspect = slope_and_aspect(elevation, transform)
    inside = geometry_mask([geometry], out_shape=elevation.shape, transform=transform, invert=True)
    inside &= ~np.isnan(slope)  # also drops cells whose neighbours are missing
    if not inside.any():
        sys.exit("No valid elevation cells inside the plot.")

    z = elevation[inside]
    mean_aspect = circular_mean_degrees(aspect[inside])
    result = {
        "name": str(plot["name"].iloc[0]) if "name" in plot.columns else None,
        "ort": str(plot["ort"].iloc[0]) if "ort" in plot.columns else None,
        "area_ha": round(geometry.area / 10000, 2),
        "elevation_min_m": round(float(z.min()), 1),
        "elevation_max_m": round(float(z.max()), 1),
        "elevation_mean_m": round(float(z.mean()), 1),
        "elevation_diff_m": round(float(z.max() - z.min()), 1),
        "slope_mean_deg": round(float(np.degrees(slope[inside]).mean()), 1),
        "slope_mean_percent": round(float((np.tan(slope[inside]) * 100).mean()), 1),
        "aspect_mean_deg": None if mean_aspect is None else round(mean_aspect),
        "aspect_compass": None if mean_aspect is None else compass_name(mean_aspect),
        "crs": crs.to_string(),
        "cells": int(inside.sum()),
        "dem_tiles": tiles,
    }

    OUT_FILE.parent.mkdir(exist_ok=True)
    OUT_FILE.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Done. Terrain of the plot written to {OUT_FILE}")
    for key, value in result.items():
        if key != "dem_tiles":
            print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
