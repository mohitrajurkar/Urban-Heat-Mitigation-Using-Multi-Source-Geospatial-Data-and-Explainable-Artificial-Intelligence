import math
from typing import List, Tuple, Dict, Any
import numpy as np

class GeospatialPreprocessor:
    """
    Geospatial Preprocessing Engine for Urban Heat Island Analysis.
    Performs spectral indices calculation and Land Surface Temperature (LST) derivation
    from satellite multi-spectral and thermal infrared bands.
    """

    @staticmethod
    def calculate_ndvi(nir_band: List[List[float]], red_band: List[List[float]]) -> Dict[str, Any]:
        """
        Calculate Normalized Difference Vegetation Index (NDVI).
        NDVI = (NIR - Red) / (NIR + Red)
        Range: -1.0 to +1.0
        """
        nir = np.array(nir_band, dtype=np.float64)
        red = np.array(red_band, dtype=np.float64)

        if nir.shape != red.shape:
            raise ValueError(f"Band dimension mismatch: NIR {nir.shape} vs Red {red.shape}")

        denominator = nir + red
        # Prevent division by zero
        with np.errstate(divide='ignore', invalid='ignore'):
            ndvi = np.where(denominator != 0, (nir - red) / denominator, 0.0)

        # Clip to physical bounds [-1, 1]
        ndvi = np.clip(ndvi, -1.0, 1.0)

        mean_val = float(np.nanmean(ndvi))
        min_val = float(np.nanmin(ndvi))
        max_val = float(np.nanmax(ndvi))

        # Classify vegetation density
        if mean_val >= 0.5:
            category = "DENSE_VEGETATION"
        elif mean_val >= 0.3:
            category = "MODERATE_VEGETATION"
        elif mean_val >= 0.15:
            category = "SPARSE_VEGETATION"
        elif mean_val >= 0.0:
            category = "BARE_SOIL_BUILTUP"
        else:
            category = "WATER_BODY"

        return {
            "mean_ndvi": round(mean_val, 4),
            "min_ndvi": round(min_val, 4),
            "max_ndvi": round(max_val, 4),
            "vegetation_density_category": category,
            "grid_shape": list(ndvi.shape),
            "ndvi_matrix": ndvi.tolist()
        }

    @staticmethod
    def calculate_ndbi(swir_band: List[List[float]], nir_band: List[List[float]]) -> Dict[str, Any]:
        """
        Calculate Normalized Difference Built-Up Index (NDBI).
        NDBI = (SWIR - NIR) / (SWIR + NIR)
        Positive values typically indicate impervious built-up urban surfaces.
        """
        swir = np.array(swir_band, dtype=np.float64)
        nir = np.array(nir_band, dtype=np.float64)

        if swir.shape != nir.shape:
            raise ValueError(f"Band dimension mismatch: SWIR {swir.shape} vs NIR {nir.shape}")

        denominator = swir + nir
        with np.errstate(divide='ignore', invalid='ignore'):
            ndbi = np.where(denominator != 0, (swir - nir) / denominator, 0.0)

        ndbi = np.clip(ndbi, -1.0, 1.0)
        mean_val = float(np.nanmean(ndbi))

        return {
            "mean_ndbi": round(mean_val, 4),
            "min_ndbi": round(float(np.nanmin(ndbi)), 4),
            "max_ndbi": round(float(np.nanmax(ndbi)), 4),
            "ndbi_matrix": ndbi.tolist()
        }

    @staticmethod
    def calculate_land_surface_temperature(
        brightness_temp_kelvin: List[List[float]],
        ndvi_matrix: List[List[float]] = None
    ) -> Dict[str, Any]:
        """
        Derive Land Surface Temperature (LST) in Celsius from thermal infrared brightness temp.
        Applies emissivity correction based on vegetation proportion (Sobrino et al. method):
        LST = BT / (1 + (lambda * BT / rho) * ln(emissivity))
        where lambda = 10.895 um (Landsat 8 Band 10), rho = 1.438 * 10^-2 m K
        """
        bt = np.array(brightness_temp_kelvin, dtype=np.float64)

        wavelength = 10.895e-6  # meters
        rho = 1.438e-2          # m * K

        # Default emissivity for mixed urban surface if NDVI is not provided
        if ndvi_matrix is not None:
            ndvi = np.array(ndvi_matrix, dtype=np.float64)
            # Fractional vegetation cover Pv
            ndvi_min = 0.05
            ndvi_max = 0.70
            pv = np.clip((ndvi - ndvi_min) / (ndvi_max - ndvi_min), 0.0, 1.0) ** 2
            # Emissivity = 0.004 * Pv + 0.986
            emissivity = 0.004 * pv + 0.986
        else:
            emissivity = np.full_like(bt, 0.97)

        # LST in Kelvin
        lst_k = bt / (1.0 + (wavelength * bt / rho) * np.log(emissivity))
        # Convert to Celsius
        lst_c = lst_k - 273.15

        mean_lst = float(np.nanmean(lst_c))
        min_lst = float(np.nanmin(lst_c))
        max_lst = float(np.nanmax(lst_c))

        if mean_lst >= 44.0:
            stress_category = "EXTREME_HEAT_STRESS"
        elif mean_lst >= 40.0:
            stress_category = "SEVERE_HEAT_STRESS"
        elif mean_lst >= 35.0:
            stress_category = "MODERATE_HEAT_STRESS"
        else:
            stress_category = "LOW_HEAT_STRESS"

        return {
            "mean_lst_celsius": round(mean_lst, 2),
            "min_lst_celsius": round(min_lst, 2),
            "max_lst_celsius": round(max_lst, 2),
            "heat_stress_category": stress_category,
            "lst_matrix_celsius": lst_c.tolist()
        }
