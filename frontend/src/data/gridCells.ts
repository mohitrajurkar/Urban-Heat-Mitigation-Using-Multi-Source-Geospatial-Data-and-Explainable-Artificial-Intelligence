import { GridCell, SeverityLevel } from "../types/index";
import { NAGPUR_WARDS } from "./nagpurWards";

// Center reference of Nagpur urban core
const CENTER_LAT = 21.1458;
const CENTER_LNG = 79.0882;

// 1 km in degrees at ~21° latitude
const LAT_STEP = 0.009009; // ~1.00 km
const LNG_STEP = 0.009660; // ~1.00 km

// Bounds of the urban envelope (~16 km north-south, ~20 km east-west)
const ROWS = 15;
const COLS = 19;
const START_LAT = CENTER_LAT - (ROWS / 2) * LAT_STEP;
const START_LNG = CENTER_LNG - (COLS / 2) * LNG_STEP;

function findNearestWard(lat: number, lng: number) {
  let closest = NAGPUR_WARDS[0];
  let minDist = Infinity;
  for (const ward of NAGPUR_WARDS) {
    const d = Math.hypot(ward.coordinates[0] - lat, ward.coordinates[1] - lng);
    if (d < minDist) {
      minDist = d;
      closest = ward;
    }
  }
  return closest;
}

function calculateGridSeverity(lst: number, builtUp: number, ndvi: number, popDensity: number, albedo: number) {
  const tempNorm = Math.min(100, Math.max(0, ((lst - 30) / 16) * 100));
  const builtUpNorm = Math.min(100, Math.max(0, builtUp));
  const vegDeficit = Math.min(100, Math.max(0, ((0.6 - ndvi) / 0.7) * 100));
  const popNorm = Math.min(100, Math.max(0, (popDensity / 30000) * 100));
  const albedoDeficit = Math.min(100, Math.max(0, ((0.35 - albedo) / 0.30) * 100));

  const score = Math.round(
    0.40 * tempNorm +
    0.20 * builtUpNorm +
    0.20 * vegDeficit +
    0.10 * popNorm +
    0.10 * albedoDeficit
  );

  let level: SeverityLevel = "Low";
  if (score >= 75) level = "Critical";
  else if (score >= 55) level = "High";
  else if (score >= 35) level = "Moderate";

  return { score, level };
}

function calculateGridPriority(severityScore: number, vulnerabilityScore: number): { score: number; level: SeverityLevel } {
  const score = Math.round(0.60 * severityScore + 0.40 * vulnerabilityScore);
  let level: SeverityLevel = "Low";
  if (score >= 75) level = "Critical";
  else if (score >= 55) level = "High";
  else if (score >= 35) level = "Moderate";
  return { score, level };
}

function recommendGridMitigation(cell: {
  builtUp: number;
  ndvi: number;
  lst: number;
  wardName: string;
}) {
  if (cell.builtUp >= 75) {
    return {
      strategyId: "cool-roofs",
      strategyName: "Cool Roofs (High-Albedo Reflective Coating)",
      category: "Engineering/Albedo",
      estimatedCostFormatted: "₹18.5 Lakh",
      expectedCoolingDrop: 3.4,
      reason: "Dense impervious built-up area (≥75%) with minimal ground space. High-albedo rooftop coatings provide immediate solar reflectance."
    };
  } else if (cell.ndvi < 0.18 && cell.builtUp >= 50) {
    return {
      strategyId: "urban-tree-plantation",
      strategyName: "Urban Tree Plantation & Avenue Shading",
      category: "Nature-Based",
      estimatedCostFormatted: "₹24.0 Lakh",
      expectedCoolingDrop: 2.8,
      reason: "Severe vegetative canopy deficit with moderate street corridor space suitable for fast-canopy indigenous avenue plantation."
    };
  } else if (cell.builtUp < 50 && cell.ndvi < 0.30) {
    return {
      strategyId: "urban-parks",
      strategyName: "Urban Pocket Parks & Micro-Forests",
      category: "Nature-Based",
      estimatedCostFormatted: "₹38.0 Lakh",
      expectedCoolingDrop: 3.6,
      reason: "Available unbuilt ground area suited for micro-forest retention buffers and Miyawaki urban cooling groves."
    };
  } else if (cell.lst >= 42.0) {
    return {
      strategyId: "reflective-roads",
      strategyName: "Reflective Road & Pavement Coatings",
      category: "Engineering/Albedo",
      estimatedCostFormatted: "₹16.5 Lakh",
      expectedCoolingDrop: 2.2,
      reason: "High asphalt thermal mass absorption along transit arteries; reflective surface treatments mitigate re-radiation."
    };
  } else {
    return {
      strategyId: "blue-infrastructure",
      strategyName: "Urban Water Retention & Mist Basins",
      category: "Urban Water",
      estimatedCostFormatted: "₹28.0 Lakh",
      expectedCoolingDrop: 2.5,
      reason: "Natural terrain drainage corridor suited for bioswales, retention mist basins, and evaporative cooling."
    };
  }
}

// Generate exactly 217 grid cells forming the contiguous urban footprint
function generateGridCells(): GridCell[] {
  type Candidate = {
    r: number;
    c: number;
    distKm: number;
    lat: number;
    lng: number;
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  };

  const candidates: Candidate[] = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const latMin = START_LAT + r * LAT_STEP;
      const latMax = latMin + LAT_STEP;
      const lngMin = START_LNG + c * LNG_STEP;
      const lngMax = lngMin + LNG_STEP;

      const lat = (latMin + latMax) / 2;
      const lng = (lngMin + lngMax) / 2;

      // Distance from center in km (approx)
      const distLatKm = (lat - CENTER_LAT) * 111.0;
      const distLngKm = (lng - CENTER_LNG) * 103.5;
      const distKm = Math.hypot(distLatKm, distLngKm);

      // Urban boundary mask: shaped like the star/radial urban shape
      const angle = Math.atan2(distLatKm, distLngKm);
      const maxRadiusKm = 8.6 + 1.8 * Math.cos(3 * angle) + 0.8 * Math.sin(2 * angle);

      if (distKm <= maxRadiusKm) {
        candidates.push({ r, c, distKm, lat, lng, latMin, latMax, lngMin, lngMax });
      }
    }
  }

  // Sort by distance and slice to exactly 217
  candidates.sort((a, b) => a.distKm - b.distKm);
  const selectedCandidates = candidates.slice(0, 217);

  // Sort for clean visual raster layout (by row descending, then col ascending)
  selectedCandidates.sort((a, b) => b.r - a.r || a.c - b.c);

  const cells: GridCell[] = [];
  let cellIndex = 1;

  for (const item of selectedCandidates) {
    const { r, c, distKm, lat, lng, latMin, latMax, lngMin, lngMax } = item;
    const nearestWard = findNearestWard(lat, lng);

    // Thermal gradient: Highest at urban core, lower at periphery
    const pseudoNoise = (Math.sin(r * 12.9898 + c * 78.233) * 43758.5453) % 1;
    const coreFactor = Math.max(0, 1 - distKm / 9.2);

    // LST (°C): core reaches 44.5 - 46.8°C, intermediate 38.0 - 43.5°C, periphery 32.0 - 36.5°C
    let baseLST = nearestWard.metrics.surfaceTemperature;
    let lst = +(baseLST * 0.65 + (33.0 + coreFactor * 13.0) * 0.35 + (pseudoNoise - 0.5) * 1.5).toFixed(1);
    lst = Math.min(46.8, Math.max(32.0, lst));

    // Built-up %
    let builtUp = Math.round(nearestWard.metrics.builtUpPercentage * 0.65 + (coreFactor * 52 + 22) * 0.35 + (pseudoNoise - 0.5) * 10);
    builtUp = Math.min(95, Math.max(15, builtUp));

    // NDVI (-0.05 to 0.60)
    let ndvi = +(nearestWard.metrics.ndvi * 0.65 + (0.55 - coreFactor * 0.45) * 0.35 + (pseudoNoise - 0.5) * 0.05).toFixed(2);
    ndvi = Math.min(0.65, Math.max(0.05, ndvi));

    // Population density (per km²)
    let populationDensity = Math.round(nearestWard.populationDensity * (0.6 + coreFactor * 0.6) + (pseudoNoise - 0.5) * 2000);
    populationDensity = Math.min(32000, Math.max(1500, populationDensity));

    // Albedo
    let albedo = +(0.12 + (1 - coreFactor) * 0.08 + (pseudoNoise - 0.5) * 0.04).toFixed(2);
    albedo = Math.min(0.32, Math.max(0.08, albedo));

    // Severity and Priority Calculations
    const { score: heatSeverity, level: severityLevel } = calculateGridSeverity(lst, builtUp, ndvi, populationDensity, albedo);
    const vulnerability = Math.round(nearestWard.vulnerability.vulnerableDemographicPercentage * 1.8 + nearestWard.vulnerability.greenSpaceDeficitPercentage * 0.35);
    const { score: priorityScore, level: priorityLevel } = calculateGridPriority(heatSeverity, vulnerability);

    const cellId = `G-${100 + cellIndex}`;
    const rec = recommendGridMitigation({ builtUp, ndvi, lst, wardName: nearestWard.name });

    cells.push({
      id: cellId,
      row: r,
      col: c,
      latitude: +lat.toFixed(5),
      longitude: +lng.toFixed(5),
      bounds: [
        [+latMin.toFixed(5), +lngMin.toFixed(5)],
        [+latMax.toFixed(5), +lngMax.toFixed(5)]
      ],
      areaKm2: 1.0,
      wardId: nearestWard.id,
      wardName: nearestWard.name,
      lst,
      ndvi,
      builtUp,
      populationDensity,
      albedo,
      heatSeverity,
      severityLevel,
      vulnerability,
      priorityScore,
      priorityLevel,
      recommendedMitigation: rec
    });

    cellIndex++;
  }

  return cells;
}

export const GRID_CELLS: GridCell[] = generateGridCells();
