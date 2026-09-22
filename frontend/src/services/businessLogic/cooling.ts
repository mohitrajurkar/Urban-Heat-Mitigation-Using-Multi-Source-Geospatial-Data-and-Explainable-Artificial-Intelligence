import { MitigationStrategy, Ward } from "../../types";

export function estimateCoolingImpact(
  strategy: MitigationStrategy,
  ward: Ward,
  coverageFraction: number = 0.25
): { coolingImpactCelsius: number; disclaimer: string } {
  const baseCooling = strategy.coolingImpactCelsius;

  let climateMultiplier = 1.0;
  if (ward.metrics.surfaceTemperature >= 43.0) {
    climateMultiplier += 0.20;
  } else if (ward.metrics.surfaceTemperature >= 40.0) {
    climateMultiplier += 0.10;
  }

  if (ward.metrics.ndvi < 0.15) {
    climateMultiplier += 0.15;
  }

  const coverageScale = Math.pow(coverageFraction / 0.25, 0.55);
  const rawCooling = baseCooling * climateMultiplier * coverageScale;
  const coolingImpactCelsius = Math.round(Math.min(Math.max(rawCooling, 0.6), 4.2) * 10) / 10;

  return {
    coolingImpactCelsius,
    disclaimer: "Prototype estimate — thermal reduction modeled via spatial cooling coefficient."
  };
}
