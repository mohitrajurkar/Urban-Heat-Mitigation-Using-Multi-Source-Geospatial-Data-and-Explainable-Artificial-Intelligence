"""Study area definitions.

Locality coordinates are approximate centroids used only to name analysis cells
and to shape the SYNTHETIC demonstration dataset. They are not survey-grade.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Locality:
    name: str
    lat: float
    lon: float
    kind: str  # commercial | residential | industrial | green | periurban | institutional
    intensity: float = 0.5  # synthetic urban intensity contribution (demo generator only)
    spread_km: float = 1.2


@dataclass(frozen=True)
class WaterBody:
    name: str
    lat: float
    lon: float
    semi_x_km: float
    semi_y_km: float


@dataclass(frozen=True)
class Zone:
    name: str
    lat: float
    lon: float
    radius_km: float


@dataclass
class StudyAreaConfig:
    name: str
    city: str
    state: str
    country: str
    bbox: tuple[float, float, float, float]  # lon_min, lat_min, lon_max, lat_max (EPSG:4326)
    epsg: int  # projected CRS used for all processing
    resolution_m: int = 100  # processing pixel size
    cell_size_m: int = 500  # analysis-region (grid cell) size
    localities: list[Locality] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "city": self.city,
            "state": self.state,
            "country": self.country,
            "bbox": list(self.bbox),
            "epsg": self.epsg,
            "resolution_m": self.resolution_m,
            "cell_size_m": self.cell_size_m,
        }


NAGPUR_LOCALITIES: list[Locality] = [
    Locality("Sitabuldi", 21.1430, 79.0830, "commercial", 0.85, 1.0),
    Locality("Dharampeth", 21.1395, 79.0650, "residential", 0.55, 1.1),
    Locality("Civil Lines", 21.1560, 79.0750, "institutional", 0.35, 1.0),
    Locality("Sadar", 21.1630, 79.0820, "commercial", 0.70, 0.9),
    Locality("Itwari", 21.1550, 79.1100, "commercial", 0.95, 0.9),
    Locality("Mahal", 21.1450, 79.1050, "commercial", 0.90, 0.9),
    Locality("Gandhibagh", 21.1520, 79.1000, "commercial", 0.85, 0.7),
    Locality("Lakadganj", 21.1560, 79.1250, "residential", 0.75, 1.0),
    Locality("Wardhaman Nagar", 21.1490, 79.1350, "residential", 0.70, 1.0),
    Locality("Pardi", 21.1600, 79.1550, "residential", 0.50, 1.2),
    Locality("Kalamna", 21.1750, 79.1400, "industrial", 0.60, 1.0),
    Locality("Nandanvan", 21.1300, 79.1300, "residential", 0.70, 1.0),
    Locality("Hudkeshwar", 21.0950, 79.1250, "periurban", 0.40, 1.3),
    Locality("Manewada", 21.1050, 79.1100, "residential", 0.65, 1.0),
    Locality("Medical Square", 21.1300, 79.0950, "commercial", 0.75, 0.8),
    Locality("Rameshwari", 21.1120, 79.0850, "residential", 0.60, 1.0),
    Locality("Ajni", 21.1250, 79.0800, "residential", 0.55, 0.9),
    Locality("Manish Nagar", 21.0950, 79.0800, "residential", 0.55, 1.1),
    Locality("Besa", 21.0800, 79.1000, "periurban", 0.40, 1.2),
    Locality("Pratap Nagar", 21.1150, 79.0500, "residential", 0.55, 1.0),
    Locality("Trimurti Nagar", 21.1120, 79.0620, "residential", 0.55, 0.9),
    Locality("Khamla", 21.1080, 79.0720, "residential", 0.60, 0.9),
    Locality("Somalwada", 21.0950, 79.0650, "residential", 0.45, 1.0),
    Locality("Ambazari", 21.1300, 79.0420, "green", 0.20, 1.0),
    Locality("Futala", 21.1530, 79.0420, "green", 0.25, 0.8),
    Locality("Gittikhadan", 21.1750, 79.0550, "residential", 0.50, 1.0),
    Locality("Seminary Hills", 21.1680, 79.0650, "green", 0.15, 1.0),
    Locality("Mankapur", 21.1830, 79.0750, "residential", 0.55, 1.0),
    Locality("Zingabai Takli", 21.1950, 79.0850, "residential", 0.50, 1.1),
    Locality("Jaripatka", 21.1820, 79.1000, "residential", 0.70, 0.9),
    Locality("Kamptee Road", 21.1900, 79.1150, "commercial", 0.55, 1.0),
    Locality("Koradi", 21.2250, 79.1000, "industrial", 0.45, 1.3),
    Locality("Gorewada", 21.1950, 79.0420, "green", 0.10, 1.2),
    Locality("Wadi", 21.1450, 78.9950, "industrial", 0.55, 1.2),
    Locality("Hingna MIDC", 21.1080, 78.9900, "industrial", 0.65, 1.4),
    Locality("Sonegaon", 21.0900, 79.0550, "institutional", 0.40, 1.0),
    Locality("MIHAN", 21.0600, 79.0450, "industrial", 0.45, 1.6),
    Locality("Wathoda", 21.1350, 79.1550, "periurban", 0.45, 1.1),
    Locality("Dighori", 21.1050, 79.1450, "periurban", 0.40, 1.1),
    Locality("Narendra Nagar", 21.1050, 79.0920, "residential", 0.60, 0.9),
    Locality("Hazaripahad", 21.1780, 79.0380, "periurban", 0.35, 1.0),
]

NAGPUR_WATER_BODIES: list[WaterBody] = [
    WaterBody("Ambazari Lake", 21.1290, 79.0360, 0.85, 0.55),
    WaterBody("Futala Lake", 21.1560, 79.0400, 0.40, 0.30),
    WaterBody("Gorewada Lake", 21.2000, 79.0380, 0.95, 0.70),
    WaterBody("Gandhisagar Lake", 21.1410, 79.1010, 0.22, 0.18),
    WaterBody("Sonegaon Lake", 21.0990, 79.0640, 0.18, 0.14),
    WaterBody("Sakkardara Lake", 21.1180, 79.1120, 0.15, 0.12),
]

NAGPUR_FORESTS: list[Zone] = [
    Zone("Seminary Hills / Ambazari Biodiversity Park", 21.1650, 79.0600, 1.1),
    Zone("Gorewada Forest", 21.2150, 79.0250, 1.8),
    Zone("Ambazari Garden belt", 21.1230, 79.0250, 0.8),
    Zone("Maharajbagh", 21.1490, 79.0770, 0.25),
]

NAGPUR_INDUSTRIAL: list[Zone] = [
    Zone("Hingna MIDC", 21.1050, 78.9850, 1.5),
    Zone("Kalamna Market Yard", 21.1780, 79.1420, 0.7),
    Zone("MIHAN SEZ", 21.0580, 79.0450, 1.4),
    Zone("Koradi Thermal Power Station", 21.2300, 79.1050, 0.9),
    Zone("Wadi Transport Hub", 21.1500, 78.9950, 0.8),
    Zone("Sonegaon Airport", 21.0920, 79.0470, 0.9),
]

NAGPUR = StudyAreaConfig(
    name="Nagpur",
    city="Nagpur",
    state="Maharashtra",
    country="India",
    bbox=(78.96, 21.04, 79.20, 21.24),
    epsg=32644,  # WGS 84 / UTM zone 44N
    resolution_m=100,
    cell_size_m=500,
    localities=NAGPUR_LOCALITIES,
)

STUDY_AREAS = {"nagpur": NAGPUR}


def get_study_area(name: str | None) -> StudyAreaConfig:
    key = (name or "nagpur").strip().lower()
    return STUDY_AREAS.get(key, NAGPUR)


def nearest_locality(lat: float, lon: float, localities: list[Locality] | None = None) -> str:
    import math

    locs = localities or NAGPUR_LOCALITIES
    kx = 111.32 * math.cos(math.radians(lat))
    best, best_d = "Nagpur", float("inf")
    for loc in locs:
        d = ((lon - loc.lon) * kx) ** 2 + ((lat - loc.lat) * 110.57) ** 2
        if d < best_d:
            best, best_d = loc.name, d
    return best
