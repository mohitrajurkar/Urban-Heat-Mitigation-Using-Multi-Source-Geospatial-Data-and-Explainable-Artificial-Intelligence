import { MITIGATION_STRATEGIES } from "../../data/mitigationStrategies";
import { MitigationStrategy, ScenarioInput, ScenarioResult, Ward } from "../../types";
import { estimateImplementationCost, formatINR } from "./cost";
import { estimateCoolingImpact } from "./cooling";
import { calculateHeatSeverity } from "./scoring";
import { calculateVulnerabilityScore } from "./vulnerability";
import { calculatePriorityScore } from "./priority";

export function simulateScenario(
  ward: Ward,
  input: ScenarioInput
): ScenarioResult {
  const coverageFraction = Math.min(Math.max(input.coveragePercentage / 100, 0.10), 1.0);

  const baseHeat = calculateHeatSeverity(ward.metrics, ward.populationDensity);
  const baseVuln = calculateVulnerabilityScore(ward, baseHeat.score);
  const basePriority = calculatePriorityScore(baseHeat.score, baseVuln.score, ward);

  let strategyName = "Combined Multi-Intervention";
  let totalCostINR = 0;
  let totalCoolingCelsius = 0;
  const coBenefits: string[] = [];

  if (input.strategyId === "combined") {
    const coolRoof = MITIGATION_STRATEGIES.find((s) => s.id === "cool-roofs")!;
    const tree = MITIGATION_STRATEGIES.find((s) => s.id === "urban-tree-plantation")!;

    const cost1 = estimateImplementationCost(coolRoof, ward, coverageFraction * 0.6);
    const cost2 = estimateImplementationCost(tree, ward, coverageFraction * 0.4);
    totalCostINR = cost1.costINR + cost2.costINR;

    const cool1 = estimateCoolingImpact(coolRoof, ward, coverageFraction * 0.6);
    const cool2 = estimateCoolingImpact(tree, ward, coverageFraction * 0.4);
    totalCoolingCelsius = Math.round((cool1.coolingImpactCelsius * 0.6 + cool2.coolingImpactCelsius * 0.65) * 10) / 10;

    coBenefits.push("Synergistic daytime solar reflection & nighttime heat release");
    coBenefits.push("Significant reduction in domestic air-conditioning peak power draw");
    coBenefits.push("Increased urban biodiversity and pedestrian shaded corridors");
  } else {
    const strat = MITIGATION_STRATEGIES.find((s) => s.id === input.strategyId) || MITIGATION_STRATEGIES[0];
    strategyName = strat.name;

    const costEst = estimateImplementationCost(strat, ward, coverageFraction);
    totalCostINR = costEst.costINR;

    const coolEst = estimateCoolingImpact(strat, ward, coverageFraction);
    totalCoolingCelsius = coolEst.coolingImpactCelsius;

    if (strat.category === "Nature-Based") {
      coBenefits.push("Enhanced urban canopy biodiversity and ambient particulate filtration");
      coBenefits.push("Improved stormwater percolation and localized groundwater recharge");
    } else if (strat.category === "Engineering/Albedo") {
      coBenefits.push("Immediate reduction in building indoor radiant heat transfer (2-4°C)");
      coBenefits.push("Extended roof waterproofing and asphalt life cycle");
    } else {
      coBenefits.push("Localized microclimate plume cooling and public amenity enhancement");
    }
  }

  const affectedPopulationBenefited = Math.round(
    ward.population * (0.30 + 0.70 * coverageFraction)
  );

  const projectedLST = Math.max(28, ward.metrics.surfaceTemperature - totalCoolingCelsius);
  const projectedMetrics = {
    ...ward.metrics,
    surfaceTemperature: projectedLST,
    ndvi: Math.min(0.8, ward.metrics.ndvi + (input.strategyId.includes("tree") || input.strategyId === "combined" ? 0.08 * coverageFraction : 0.01)),
    albedo: Math.min(0.40, ward.metrics.albedo + (input.strategyId.includes("roof") || input.strategyId === "combined" ? 0.12 * coverageFraction : 0.02))
  };

  const projectedHeat = calculateHeatSeverity(projectedMetrics, ward.populationDensity);
  const projectedVuln = calculateVulnerabilityScore(ward, projectedHeat.score);
  const projectedPriority = calculatePriorityScore(projectedHeat.score, projectedVuln.score, ward);

  const priorityReductionPoints = Math.round((basePriority.score - projectedPriority.score) * 10) / 10;

  return {
    wardId: ward.id,
    wardName: ward.name,
    strategyName,
    coveragePercentage: input.coveragePercentage,
    estimatedCostINR: totalCostINR,
    estimatedCostFormatted: formatINR(totalCostINR),
    expectedCoolingCelsius: totalCoolingCelsius,
    affectedPopulationBenefited,
    baselinePriorityScore: basePriority.score,
    projectedPriorityScore: projectedPriority.score,
    priorityReductionPoints: Math.max(0, priorityReductionPoints),
    coBenefits
  };
}
