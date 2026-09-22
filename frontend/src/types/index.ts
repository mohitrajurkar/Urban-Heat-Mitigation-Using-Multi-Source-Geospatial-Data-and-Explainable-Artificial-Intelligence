export type SeverityLevel = "Low" | "Moderate" | "High" | "Critical";

export interface HeatMetrics {
  surfaceTemperature: number;       // Land Surface Temperature (LST) in °C (e.g., 34.0 to 45.5)
  ndvi: number;                     // Normalized Difference Vegetation Index (-0.1 to +0.8)
  builtUpPercentage: number;        // Concrete / impervious surface % (0 to 100)
  albedo: number;                   // Surface reflectivity factor (0.05 to 0.40)
  openSpacePercentage: number;      // Available ground / unbuilt % (0 to 100)
  treeCanopyPercentage: number;     // Existing canopy cover % (0 to 100)
}

export interface VulnerabilityMetrics {
  vulnerableDemographicPercentage: number;  // Children (<5) & elderly (>65) exposure %
  slumOrInformalSettlementPercentage: number; // High-density informal settlement %
  hospitalOrClinicDistanceKm: number;        // Average access distance to cooling/medical center
  greenSpaceDeficitPercentage: number;       // Deficit compared to WHO recommended green norms
}

export interface Ward {
  id: string;
  name: string;
  zone: string;
  prabhagNo: number;
  coordinates: [number, number]; // [lat, lng]
  boundaryCoordinates: [number, number][]; // Polygon coordinates
  areaKm2: number;
  population: number;
  populationDensity: number; // per sq km
  metrics: HeatMetrics;
  vulnerability: VulnerabilityMetrics;
}

export interface GridCell {
  id: string;                      // e.g. "G-101"
  row: number;
  col: number;
  latitude: number;
  longitude: number;
  bounds: [[number, number], [number, number]]; // [[south, west], [north, east]]
  areaKm2: number;                 // 1.0 (1 km x 1 km)
  wardId: string;                  // Parent administrative ward ID
  wardName: string;                // Parent administrative ward name
  lst: number;                     // Land Surface Temperature in °C (e.g. 33.2 to 46.5)
  ndvi: number;                    // -0.1 to 0.6
  builtUp: number;                 // Built-up percentage (0 to 100)
  populationDensity: number;       // Inhabitants per km²
  albedo: number;                  // Surface albedo reflectivity (0.05 to 0.40)
  heatSeverity: number;            // 0 to 100 composite score
  severityLevel: SeverityLevel;    // Low | Moderate | High | Critical
  vulnerability: number;           // 0 to 100 demographic exposure score
  priorityScore: number;           // 0 to 100 priority score
  priorityLevel: SeverityLevel;
  recommendedMitigation?: {
    strategyId: string;
    strategyName: string;
    category: string;
    estimatedCostFormatted: string;
    expectedCoolingDrop: number;
    reason: string;
  };
}

export interface City {
  id: string;
  name: string;
  state: string;
  country: string;
  center: [number, number];
  zoom: number;
  isPrototype: boolean;
  totalWards: number;
  totalGridCells: number;
  avgLST: number;
  highRiskZonesCount: number;
  populationCovered: string;
}

export interface MitigationStrategy {
  id: string;
  name: string;
  category: "Nature-Based" | "Engineering/Albedo" | "Hybrid" | "Urban Water";
  description: string;
  costPerUnitINR: number;
  costUnit: string;
  coolingImpactCelsius: number; // Baseline cooling potential
  implementationTime: "Immediate (<3 mo)" | "Short (3-6 mo)" | "Medium (6-12 mo)" | "Long (>12 mo)";
  maintenanceLevel: "Low" | "Medium" | "High";
  vegetationRequirement: "None" | "Low" | "Moderate" | "High";
  spaceRequirement: "Rooftop" | "Open Ground" | "Street Corridor" | "Pavement" | "Water Body";
  suitableFor: string[];
  prototypeDisclaimer: string;
}

export interface Recommendation {
  strategy: MitigationStrategy;
  suitabilityScore: number;
  estimatedCostINR: number;
  estimatedCostFormatted: string;
  expectedCoolingDrop: number; // in °C
  implementationTime: string;
  maintenanceLevel: string;
  reason: string;
  disclaimer: string;
}

export interface DecisionResult {
  wardId: string;
  wardName: string;
  heatSeverity: {
    score: number;
    level: SeverityLevel;
    breakdown: {
      temperatureFactor: number;
      builtUpFactor: number;
      vegetationFactor: number;
      populationFactor: number;
      albedoFactor: number;
    };
    modelNote: string;
  };
  vulnerability: {
    score: number;
    level: SeverityLevel;
    factors: string[];
  };
  priority: {
    score: number;
    level: SeverityLevel;
    reason: string;
  };
  explainableFactors: {
    title: string;
    whyHighPriority: string[];
    whyStrategyRecommended: string;
    shapPlaceholderNote: string;
  };
  recommendations: Recommendation[];
}

export interface ScenarioInput {
  wardId: string;
  strategyId: string;
  coveragePercentage: number; // 10 to 100
}

export interface ScenarioResult {
  wardId: string;
  wardName: string;
  strategyName: string;
  coveragePercentage: number;
  estimatedCostINR: number;
  estimatedCostFormatted: string;
  expectedCoolingCelsius: number;
  affectedPopulationBenefited: number;
  baselinePriorityScore: number;
  projectedPriorityScore: number;
  priorityReductionPoints: number;
  coBenefits: string[];
}
