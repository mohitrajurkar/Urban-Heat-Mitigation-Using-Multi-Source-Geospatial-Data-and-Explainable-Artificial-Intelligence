"""Analysis grid: a projected pixel grid plus coarser square analysis cells (regions)."""
from __future__ import annotations

import math
from dataclasses import asdict, dataclass

import numpy as np
from affine import Affine
from pyproj import Transformer

from app.geospatial.study_area import StudyAreaConfig


@dataclass
class AnalysisGrid:
    epsg: int
    xmin: float
    ymax: float
    resolution: float
    width: int
    height: int
    cell_px: int  # pixels per analysis cell side

    @classmethod
    def from_study_area(cls, sa: StudyAreaConfig) -> "AnalysisGrid":
        if sa.cell_size_m % sa.resolution_m != 0:
            raise ValueError("cell_size_m must be a multiple of resolution_m")
        tr = Transformer.from_crs(4326, sa.epsg, always_xy=True)
        lon0, lat0, lon1, lat1 = sa.bbox
        xs, ys = tr.transform([lon0, lon1, lon0, lon1], [lat0, lat0, lat1, lat1])
        c = sa.cell_size_m
        xmin, xmax = math.floor(min(xs) / c) * c, math.ceil(max(xs) / c) * c
        ymin, ymax = math.floor(min(ys) / c) * c, math.ceil(max(ys) / c) * c
        res = sa.resolution_m
        return cls(
            epsg=sa.epsg,
            xmin=float(xmin),
            ymax=float(ymax),
            resolution=float(res),
            width=int(round((xmax - xmin) / res)),
            height=int(round((ymax - ymin) / res)),
            cell_px=c // res,
        )

    @classmethod
    def from_dict(cls, d: dict) -> "AnalysisGrid":
        return cls(**{k: d[k] for k in cls.__dataclass_fields__})

    def to_dict(self) -> dict:
        d = asdict(self)
        d["bounds_lonlat"] = self.bounds_lonlat()
        d["n_rows_cells"], d["n_cols_cells"] = self.cell_shape
        return d

    @property
    def transform(self) -> Affine:
        return Affine(self.resolution, 0.0, self.xmin, 0.0, -self.resolution, self.ymax)

    @property
    def shape(self) -> tuple[int, int]:
        return self.height, self.width

    @property
    def cell_shape(self) -> tuple[int, int]:
        return self.height // self.cell_px, self.width // self.cell_px

    @property
    def pixel_area_km2(self) -> float:
        return (self.resolution / 1000.0) ** 2

    @property
    def cell_area_km2(self) -> float:
        return (self.resolution * self.cell_px / 1000.0) ** 2

    def bounds(self) -> tuple[float, float, float, float]:
        return (self.xmin, self.ymax - self.height * self.resolution, self.xmin + self.width * self.resolution, self.ymax)

    def bounds_lonlat(self) -> list[float]:
        x0, y0, x1, y1 = self.bounds()
        tr = Transformer.from_crs(self.epsg, 4326, always_xy=True)
        lons, lats = tr.transform([x0, x1, x0, x1], [y0, y0, y1, y1])
        return [min(lons), min(lats), max(lons), max(lats)]

    def pixel_centers(self) -> tuple[np.ndarray, np.ndarray]:
        cols = self.xmin + (np.arange(self.width) + 0.5) * self.resolution
        rows = self.ymax - (np.arange(self.height) + 0.5) * self.resolution
        return np.meshgrid(cols, rows)

    def pixel_to_lonlat(self, row: float, col: float) -> tuple[float, float]:
        x = self.xmin + (col + 0.5) * self.resolution
        y = self.ymax - (row + 0.5) * self.resolution
        tr = Transformer.from_crs(self.epsg, 4326, always_xy=True)
        lon, lat = tr.transform(x, y)
        return float(lon), float(lat)

    def xy_to_pixel(self, x, y) -> tuple[np.ndarray, np.ndarray]:
        col = np.floor((np.asarray(x) - self.xmin) / self.resolution).astype(int)
        row = np.floor((self.ymax - np.asarray(y)) / self.resolution).astype(int)
        return row, col

    def cell_index(self) -> np.ndarray:
        """Per-pixel analysis-cell index (row-major), -1 outside complete cells."""
        n_r, n_c = self.cell_shape
        rr, cc = np.meshgrid(np.arange(self.height) // self.cell_px, np.arange(self.width) // self.cell_px, indexing="ij")
        idx = rr * n_c + cc
        idx[(rr >= n_r) | (cc >= n_c)] = -1
        return idx

    def cell_polygons_lonlat(self) -> list[dict]:
        """One record per cell: code, row, col, polygon ring (lon/lat), centroid."""
        n_r, n_c = self.cell_shape
        tr = Transformer.from_crs(self.epsg, 4326, always_xy=True)
        size = self.resolution * self.cell_px
        cells = []
        for r in range(n_r):
            for c in range(n_c):
                x0 = self.xmin + c * size
                y1 = self.ymax - r * size
                xs = [x0, x0 + size, x0 + size, x0, x0]
                ys = [y1, y1, y1 - size, y1 - size, y1]
                lons, lats = tr.transform(xs, ys)
                clon, clat = tr.transform(x0 + size / 2, y1 - size / 2)
                cells.append(
                    {
                        "cell_index": r * n_c + c,
                        "row": r,
                        "col": c,
                        "ring": [[round(lo, 6), round(la, 6)] for lo, la in zip(lons, lats)],
                        "centroid": [round(clon, 6), round(clat, 6)],
                    }
                )
        return cells
