import { HeatMetrics, SeverityLevel } from "../../types";

export const HEAT_SEVERITY_CONFIG = {
  temperatureWeight: 0.40,
  builtUpWeight: 0.20,
  vegetationWeight: 0.20,
  populationDensityWeight: 0.10,
  albedoWeight: 0.10
};

export interface HeatSeverityResult {
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
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function calculateHeatSeverity(
  metrics: HeatMetrics,
  populationDensity: number = 15000
): HeatSeverityResult {
  const normTemp = clamp((metrics.surfaceTemperature - 30.0) / (48.0 - 30.0), 0, 1) * 100;
  const normBuiltUp = clamp(metrics.builtUpPercentage, 0, 100);
  const normVegetation = (1 - clamp(metrics.ndvi / 0.75, 0, 1)) * 100;
  const normPopDensity = clamp(populationDensity / 30000, 0, 1) * 100;
  const normAlbedo = (1 - clamp((metrics.albedo - 0.08) / (0.35 - 0.08), 0, 1)) * 100;

  const rawScore =
    normTemp * HEAT_SEVERITY_CONFIG.temperatureWeight +
    normBuiltUp * HEAT_SEVERITY_CONFIG.builtUpWeight +
    normVegetation * HEAT_SEVERITY_CONFIG.vegetationWeight +
    normPopDensity * HEAT_SEVERITY_CONFIG.populationDensityWeight +
    normAlbedo * HEAT_SEVERITY_CONFIG.albedoWeight;

  const score = Math.round(clamp(rawScore, 0, 100) * 10) / 10;

  let level: SeverityLevel = "Low";
  if (score >= 75) {
    level = "Critical";
  } else if (score >= 55) {
    level = "High";
  } else if (score >= 35) {
    level = "Moderate";
  }

  return {
    score,
    level,
    breakdown: {
      temperatureFactor: Math.round(normTemp * 10) / 10,
      builtUpFactor: Math.round(normBuiltUp * 10) / 10,
      vegetationFactor: Math.round(normVegetation * 10) / 10,
      populationFactor: Math.round(normPopDensity * 10) / 10,
      albedoFactor: Math.round(normAlbedo * 10) / 10
    },
    modelNote: "Prototype weighted scoring model (40% Temp + 20% Built-up + 20% Low Veg + 10% Pop Density + 10% Low Albedo)"
  };
}
