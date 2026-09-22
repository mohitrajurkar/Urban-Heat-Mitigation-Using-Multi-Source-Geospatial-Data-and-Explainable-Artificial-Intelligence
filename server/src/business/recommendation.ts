import { MITIGATION_STRATEGIES } from "../data/mitigationStrategies";
import { MitigationStrategy, Recommendation, Ward } from "../types";
import { estimateImplementationCost } from "./cost";
import { estimateCoolingImpact } from "./cooling";

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

/**
 * Evaluates all candidate mitigation strategies for a given ward and ranks the top 3.
 * Formula:
 * Suitability Score = (Cooling Benefit * 0.35) + (Urgency/Need * 0.30) + (Spatial Feasibility * 0.25) - (Cost Penalty * 0.10)
 * Tag: "Recommended based on the prototype scoring model."
 */
export function recommendMitigationStrategies(
  ward: Ward,
  heatSeverityScore: number,
  vulnerabilityScore: number
): Recommendation[] {
  const scoredStrategies: { strategy: MitigationStrategy; suitability: number; reason: string }[] = [];

  for (const strat of MITIGATION_STRATEGIES) {
    // 1. Cooling Benefit factor (0 to 100 based on strategy baseline potential)
    const normCooling = clamp((strat.coolingImpactCelsius / 3.5) * 100, 0, 100);

    // 2. Need / Urgency factor (combination of heat severity and ward vulnerability)
    const normNeed = (heatSeverityScore * 0.6) + (vulnerabilityScore * 0.4);

    // 3. Spatial Feasibility factor based on strategy requirements and ward land-use
    let feasibility = 60; // baseline
    let specificReason = "";

    switch (strat.id) {
      case "cool-roofs":
        if (ward.metrics.builtUpPercentage >= 70) {
          feasibility = 95;
          specificReason = `High built-up density (${ward.metrics.builtUpPercentage}%) provides ample flat rooftop surface for fast, non-disruptive thermal reflection.`;
        } else {
          feasibility = 75;
          specificReason = "Substantial residential roof surfaces allow immediate solar reflectance gains.";
        }
        break;

      case "urban-tree-plantation":
        if (ward.metrics.ndvi < 0.20) {
          feasibility = 90;
          specificReason = `Acute vegetation deficit (NDVI ${ward.metrics.ndvi}) makes avenue tree plantation critical for restoring pedestrian shading.`;
        } else {
          feasibility = 70;
          specificReason = "Expansion of street canopy reinforces existing green buffers against heat corridors.";
        }
        break;

      case "green-roofs":
        if (ward.metrics.builtUpPercentage >= 75 && ward.metrics.openSpacePercentage < 10) {
          feasibility = 80;
          specificReason = `Limited ground open space (${ward.metrics.openSpacePercentage}%) makes vegetated roof infrastructure optimal for localized evapotranspiration.`;
        } else {
          feasibility = 65;
          specificReason = "Provides high thermal insulation for institutional and commercial buildings.";
        }
        break;

      case "urban-parks":
        if (ward.metrics.openSpacePercentage >= 12) {
          feasibility = 92;
          specificReason = `Sufficient open ground (${ward.metrics.openSpacePercentage}%) enables development of dense micro-forests and pocket parks.`;
        } else {
          feasibility = 45; // difficult in ultra-dense wards
          specificReason = `Open ground is scarce (${ward.metrics.openSpacePercentage}%), restricting park development to small pocket gardens.`;
        }
        break;

      case "permeable-pavements":
        if (ward.metrics.builtUpPercentage >= 65) {
          feasibility = 85;
          specificReason = "Effective retrofitting of sidewalks and parking plazas to eliminate heat trapping without building modifications.";
        } else {
          feasibility = 60;
          specificReason = "Reduces stormwater runoff and sensible heat re-radiation across paved walkways.";
        }
        break;

      case "blue-infrastructure":
        if (ward.id.includes("sakkardara") || ward.metrics.openSpacePercentage >= 14) {
          feasibility = 86;
          specificReason = "Lake proximity or open drainage basins allow water rejuvenation to cast significant evaporative cooling plumes.";
        } else {
          feasibility = 50;
          specificReason = "High-impact evaporative cooling best situated near civic squares and park boundaries.";
        }
        break;

      case "reflective-roads":
        if (ward.metrics.builtUpPercentage >= 70 && ward.metrics.albedo <= 0.16) {
          feasibility = 88;
          specificReason = `Low roadway albedo (${ward.metrics.albedo}) and heavy traffic corridors make light asphalt coating highly effective.`;
        } else {
          feasibility = 65;
          specificReason = "Lowers road surface temperature by 8-12°C, suppressing night-time heat island release.";
        }
        break;

      default:
        feasibility = 70;
        specificReason = "General thermal mitigation intervention suited to urban parameters.";
        break;
    }

    // 4. Cost Factor penalty (0 to 100 based on unit cost)
    const costFactor = clamp((strat.costPerUnitINR / 2500) * 100, 10, 100);

    // Multi-criteria suitability formula
    const rawSuitability =
      normCooling * 0.35 +
      normNeed * 0.30 +
      feasibility * 0.25 -
      costFactor * 0.10;

    const suitability = Math.round(clamp(rawSuitability, 10, 98));

    scoredStrategies.push({
      strategy: strat,
      suitability,
      reason: specificReason
    });
  }

  // Sort descending by suitability
  scoredStrategies.sort((a, b) => b.suitability - a.suitability);

  // Return Top 3 recommendations
  return scoredStrategies.slice(0, 3).map((item) => {
    const costEst = estimateImplementationCost(item.strategy, ward, 0.25);
    const coolEst = estimateCoolingImpact(item.strategy, ward, 0.25);

    return {
      strategy: item.strategy,
      suitabilityScore: item.suitability,
      estimatedCostINR: costEst.costINR,
      estimatedCostFormatted: costEst.formattedCost,
      expectedCoolingDrop: coolEst.coolingImpactCelsius,
      implementationTime: item.strategy.implementationTime,
      maintenanceLevel: item.strategy.maintenanceLevel,
      reason: item.reason,
      disclaimer: "Recommended based on the prototype scoring model — to be verified with field audits."
    };
  });
}
