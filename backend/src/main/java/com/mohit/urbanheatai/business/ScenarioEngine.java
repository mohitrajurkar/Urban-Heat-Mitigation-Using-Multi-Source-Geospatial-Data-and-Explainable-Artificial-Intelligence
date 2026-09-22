package com.mohit.urbanheatai.business;

import com.mohit.urbanheatai.dto.*;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Component
public class ScenarioEngine {

    private final ScoringEngine scoringEngine;
    private final VulnerabilityEngine vulnerabilityEngine;
    private final PriorityEngine priorityEngine;
    private final CostEngine costEngine;
    private final CoolingEngine coolingEngine;

    public ScenarioEngine(ScoringEngine scoringEngine, VulnerabilityEngine vulnerabilityEngine,
                          PriorityEngine priorityEngine, CostEngine costEngine, CoolingEngine coolingEngine) {
        this.scoringEngine = scoringEngine;
        this.vulnerabilityEngine = vulnerabilityEngine;
        this.priorityEngine = priorityEngine;
        this.costEngine = costEngine;
        this.coolingEngine = coolingEngine;
    }

    public ScenarioResultDTO simulateScenario(WardDTO ward, ScenarioInputDTO input, List<MitigationStrategyDTO> availableStrategies) {
        double coverageFraction = Math.min(1.0, Math.max(0.10, input.getCoveragePercentage() / 100.0));

        DecisionResultDTO.HeatSeverityDetails baseHeat = scoringEngine.calculateHeatSeverity(ward.getMetrics(), ward.getPopulationDensity());
        DecisionResultDTO.VulnerabilityDetails baseVuln = vulnerabilityEngine.calculateVulnerabilityScore(ward, baseHeat.getScore());
        DecisionResultDTO.PriorityDetails basePriority = priorityEngine.calculatePriorityScore(baseHeat.getScore(), baseVuln.getScore(), ward);

        String strategyName = "Combined Multi-Intervention";
        long totalCostINR = 0L;
        double totalCoolingCelsius = 0.0;
        List<String> coBenefits = new ArrayList<>();

        if ("combined".equalsIgnoreCase(input.getStrategyId())) {
            MitigationStrategyDTO coolRoof = availableStrategies.stream().filter(s -> "cool-roofs".equals(s.getId())).findFirst().orElse(null);
            MitigationStrategyDTO tree = availableStrategies.stream().filter(s -> "urban-tree-plantation".equals(s.getId())).findFirst().orElse(null);

            if (coolRoof != null && tree != null) {
                CostEngine.CostEstimate cost1 = costEngine.estimateImplementationCost(coolRoof, ward, coverageFraction * 0.6);
                CostEngine.CostEstimate cost2 = costEngine.estimateImplementationCost(tree, ward, coverageFraction * 0.4);
                totalCostINR = cost1.getCostINR() + cost2.getCostINR();

                CoolingEngine.CoolingEstimate cool1 = coolingEngine.estimateCoolingImpact(coolRoof, ward, coverageFraction * 0.6);
                CoolingEngine.CoolingEstimate cool2 = coolingEngine.estimateCoolingImpact(tree, ward, coverageFraction * 0.4);
                totalCoolingCelsius = Math.round((cool1.getCoolingImpactCelsius() * 0.6 + cool2.getCoolingImpactCelsius() * 0.65) * 10.0) / 10.0;
            }

            coBenefits.add("Synergistic daytime solar reflection & nighttime heat release");
            coBenefits.add("Significant reduction in domestic air-conditioning peak power draw");
            coBenefits.add("Increased urban biodiversity and pedestrian shaded corridors");
        } else {
            MitigationStrategyDTO strat = availableStrategies.stream()
                    .filter(s -> s.getId().equalsIgnoreCase(input.getStrategyId()))
                    .findFirst()
                    .orElse(availableStrategies.get(0));

            strategyName = strat.getName();
            CostEngine.CostEstimate costEst = costEngine.estimateImplementationCost(strat, ward, coverageFraction);
            totalCostINR = costEst.getCostINR();

            CoolingEngine.CoolingEstimate coolEst = coolingEngine.estimateCoolingImpact(strat, ward, coverageFraction);
            totalCoolingCelsius = coolEst.getCoolingImpactCelsius();

            if ("Nature-Based".equalsIgnoreCase(strat.getCategory())) {
                coBenefits.add("Enhanced urban canopy biodiversity and ambient particulate filtration");
                coBenefits.add("Improved stormwater percolation and localized groundwater recharge");
            } else if ("Engineering/Albedo".equalsIgnoreCase(strat.getCategory())) {
                coBenefits.add("Immediate reduction in building indoor radiant heat transfer (2-4°C)");
                coBenefits.add("Extended roof waterproofing and asphalt life cycle");
            } else {
                coBenefits.add("Localized microclimate plume cooling and public amenity enhancement");
            }
        }

        long affectedPopulationBenefited = Math.round(ward.getPopulation() * (0.30 + 0.70 * coverageFraction));

        double projectedLST = Math.max(28.0, ward.getMetrics().getSurfaceTemperature() - totalCoolingCelsius);
        HeatMetricsDTO projectedMetrics = new HeatMetricsDTO(
                projectedLST,
                Math.min(0.80, ward.getMetrics().getNdvi() + (input.getStrategyId().contains("tree") || "combined".equals(input.getStrategyId()) ? 0.08 * coverageFraction : 0.01)),
                ward.getMetrics().getBuiltUpPercentage(),
                Math.min(0.40, ward.getMetrics().getAlbedo() + (input.getStrategyId().contains("roof") || "combined".equals(input.getStrategyId()) ? 0.12 * coverageFraction : 0.02)),
                ward.getMetrics().getOpenSpacePercentage(),
                ward.getMetrics().getTreeCanopyPercentage()
        );

        DecisionResultDTO.HeatSeverityDetails projectedHeat = scoringEngine.calculateHeatSeverity(projectedMetrics, ward.getPopulationDensity());
        DecisionResultDTO.VulnerabilityDetails projectedVuln = vulnerabilityEngine.calculateVulnerabilityScore(ward, projectedHeat.getScore());
        DecisionResultDTO.PriorityDetails projectedPriority = priorityEngine.calculatePriorityScore(projectedHeat.getScore(), projectedVuln.getScore(), ward);

        double priorityReductionPoints = Math.round((basePriority.getScore() - projectedPriority.getScore()) * 10.0) / 10.0;

        ScenarioResultDTO result = new ScenarioResultDTO();
        result.setWardId(ward.getId());
        result.setWardName(ward.getName());
        result.setStrategyName(strategyName);
        result.setCoveragePercentage(input.getCoveragePercentage());
        result.setEstimatedCostINR(totalCostINR);
        result.setEstimatedCostFormatted(costEngine.formatINR(totalCostINR));
        result.setExpectedCoolingCelsius(totalCoolingCelsius);
        result.setAffectedPopulationBenefited(affectedPopulationBenefited);
        result.setBaselinePriorityScore(basePriority.getScore());
        result.setProjectedPriorityScore(projectedPriority.getScore());
        result.setPriorityReductionPoints(Math.max(0.0, priorityReductionPoints));
        result.setCoBenefits(coBenefits);

        return result;
    }
}
