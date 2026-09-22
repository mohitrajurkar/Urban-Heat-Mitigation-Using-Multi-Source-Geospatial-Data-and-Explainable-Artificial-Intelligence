import { MitigationStrategy, Ward } from "../types";

/**
 * Estimates prototype localized surface and ambient cooling impact in °C.
 * Considers strategy baseline cooling, ward microclimate deficit, and coverage intensity.
 * Label: "Prototype estimate"
 */
export function estimateCoolingImpact(
  strategy: MitigationStrategy,
  ward: Ward,
  coverageFraction: number = 0.25
): { coolingImpactCelsius: number; disclaimer: string } {
  const baseCooling = strategy.coolingImpactCelsius;

  // Thermal amplification modifier: hotter wards with lower NDVI experience greater cooling relief
  let climateMultiplier = 1.0;
  if (ward.metrics.surfaceTemperature >= 43.0) {
    climateMultiplier += 0.20;
  } else if (ward.metrics.surfaceTemperature >= 40.0) {
    climateMultiplier += 0.10;
  }

  if (ward.metrics.ndvi < 0.15) {
    climateMultiplier += 0.15;
  }

  // Non-linear coverage scaling (diminishing returns beyond high saturation)
  // baseline assumption corresponds to ~25% coverage
  const coverageScale = Math.pow(coverageFraction / 0.25, 0.55);

  const rawCooling = baseCooling * climateMultiplier * coverageScale;
  // Bounded between 0.6°C and 4.2°C for realistic urban microclimate simulation
  const coolingImpactCelsius = Math.round(Math.min(Math.max(rawCooling, 0.6), 4.2) * 10) / 10;

  return {
    coolingImpactCelsius,
    disclaimer: "Prototype estimate — thermal reduction modeled via spatial cooling coefficient."
  };
}
