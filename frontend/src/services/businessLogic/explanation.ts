import { MitigationStrategy, Ward } from "../../types";
import { HeatSeverityResult } from "./scoring";
import { VulnerabilityResult } from "./vulnerability";

export interface FeatureExplanation {
  title: string;
  whyHighPriority: string[];
  whyStrategyRecommended: string;
  shapPlaceholderNote: string;
}

export function generateFeatureExplanation(
  ward: Ward,
  heatResult: HeatSeverityResult,
  vulnResult: VulnerabilityResult,
  topStrategy?: MitigationStrategy
): FeatureExplanation {
  const whyHighPriority: string[] = [];

  if (ward.metrics.surfaceTemperature >= 42.0) {
    whyHighPriority.push(`Elevated Land Surface Temperature of ${ward.metrics.surfaceTemperature}°C exceeds municipal safe threshold.`);
  }

  if (ward.metrics.builtUpPercentage >= 75.0) {
    whyHighPriority.push(`Impervious built-up surface is ${ward.metrics.builtUpPercentage}%, triggering high thermal mass retention.`);
  }

  if (ward.metrics.ndvi <= 0.18) {
    whyHighPriority.push(`Severe vegetative deficit with NDVI of ${ward.metrics.ndvi} indicates acute absence of evaporative cooling.`);
  }

  if (ward.populationDensity >= 18000) {
    whyHighPriority.push(`Dense population exposure with ${ward.populationDensity.toLocaleString()} citizens/km² in immediate danger zone.`);
  }

  if (ward.vulnerability.vulnerableDemographicPercentage >= 20) {
    whyHighPriority.push(`High demographic sensitivity: ${ward.vulnerability.vulnerableDemographicPercentage}% are children under 5 or elderly over 65.`);
  }

  if (whyHighPriority.length === 0) {
    whyHighPriority.push(`Localized microclimate demonstrates moderate heat elevation (${ward.metrics.surfaceTemperature}°C) with balanced canopy.`);
  }

  let whyStrategyRecommended = "";
  if (topStrategy) {
    switch (topStrategy.id) {
      case "cool-roofs":
        whyStrategyRecommended = `Cool roofs receive high suitability (${ward.metrics.builtUpPercentage}% built-up area) as horizontal rooftop expanse can be retrofitted without requiring scarce ground parcel acquisitions.`;
        break;
      case "urban-tree-plantation":
        whyStrategyRecommended = `Tree plantation is strongly favored due to acute vegetation deficit (NDVI ${ward.metrics.ndvi}) and street corridor availability to create continuous pedestrian shade.`;
        break;
      case "green-roofs":
        whyStrategyRecommended = `Vegetated green roofs maximize insulation for concrete buildings while contributing biological transpiration in densely packed blocks.`;
        break;
      case "urban-parks":
        whyStrategyRecommended = `Urban pocket parks are recommended to address the critical ${ward.vulnerability.greenSpaceDeficitPercentage}% green space deficit and establish cold-island anchor zones.`;
        break;
      case "permeable-pavements":
        whyStrategyRecommended = `Permeable pavements are prioritized to mitigate ground heat re-radiation and improve storm-water retention across high-traffic footpaths.`;
        break;
      case "blue-infrastructure":
        whyStrategyRecommended = `Water bodies and evaporative features provide high-intensity localized cooling plumes across congested civic areas.`;
        break;
      case "reflective-roads":
        whyStrategyRecommended = `Reflective road coatings are ideal for high-traffic corridors with low albedo (${ward.metrics.albedo}) where vehicular friction exacerbates the thermal envelope.`;
        break;
      default:
        whyStrategyRecommended = `${topStrategy.name} yields the optimal balance of immediate cooling drop and spatial feasibility for ${ward.name}.`;
        break;
    }
  } else {
    whyStrategyRecommended = "Interventions prioritized based on multi-criteria cooling efficiency, spatial feasibility, and capital requirements.";
  }

  return {
    title: "Explainable Decision Factors",
    whyHighPriority,
    whyStrategyRecommended,
    shapPlaceholderNote: "Prototype explainability layer. SHAP-based explanations will be integrated with the ML model in a later phase."
  };
}
