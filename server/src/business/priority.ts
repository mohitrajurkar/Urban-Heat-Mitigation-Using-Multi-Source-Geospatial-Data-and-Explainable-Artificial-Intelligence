import { SeverityLevel, Ward } from "../types";

export interface PriorityResult {
  score: number;
  level: SeverityLevel;
  reason: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Calculates unified Decision Support Priority Score (60% Heat Severity + 40% Vulnerability).
 * Generates an automated, data-driven synthesis reason.
 */
export function calculatePriorityScore(
  heatSeverityScore: number,
  vulnerabilityScore: number,
  ward: Ward
): PriorityResult {
  const rawScore = heatSeverityScore * 0.60 + vulnerabilityScore * 0.40;
  const score = Math.round(clamp(rawScore, 0, 100) * 10) / 10;

  let level: SeverityLevel = "Low";
  if (score >= 72) {
    level = "Critical";
  } else if (score >= 52) {
    level = "High";
  } else if (score >= 32) {
    level = "Moderate";
  }

  // Generate dynamic synthesis reason based on actual data
  const statements: string[] = [];

  if (ward.metrics.surfaceTemperature >= 43.0) {
    statements.push(`Extreme land surface temperature (${ward.metrics.surfaceTemperature}°C)`);
  } else if (ward.metrics.surfaceTemperature >= 40.0) {
    statements.push(`Elevated surface temperature (${ward.metrics.surfaceTemperature}°C)`);
  } else {
    statements.push(`Moderate surface temperature (${ward.metrics.surfaceTemperature}°C)`);
  }

  if (ward.metrics.ndvi < 0.15) {
    statements.push(`severe vegetation deficit (NDVI ${ward.metrics.ndvi})`);
  } else if (ward.metrics.ndvi < 0.25) {
    statements.push(`sparse vegetative cover (NDVI ${ward.metrics.ndvi})`);
  }

  if (ward.metrics.builtUpPercentage >= 80) {
    statements.push(`dense concrete imperviousness (${ward.metrics.builtUpPercentage}%)`);
  }

  if (ward.populationDensity >= 20000) {
    statements.push(`high population exposure (${ward.populationDensity.toLocaleString()} people/km²)`);
  }

  const reason = statements.length > 1
    ? `${statements[0]} combined with ${statements.slice(1).join(" and ")}.`
    : `${statements[0]} under current urban canopy conditions.`;

  return {
    score,
    level,
    reason
  };
}
