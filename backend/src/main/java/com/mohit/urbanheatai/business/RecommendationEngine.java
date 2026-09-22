package com.mohit.urbanheatai.business;

import com.mohit.urbanheatai.dto.MitigationStrategyDTO;
import com.mohit.urbanheatai.dto.RecommendationDTO;
import com.mohit.urbanheatai.dto.WardDTO;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Component
public class RecommendationEngine {

    private final CostEngine costEngine;
    private final CoolingEngine coolingEngine;

    public RecommendationEngine(CostEngine costEngine, CoolingEngine coolingEngine) {
        this.costEngine = costEngine;
        this.coolingEngine = coolingEngine;
    }

    private double clamp(double val, double min, double max) {
        return Math.max(min, Math.min(max, val));
    }

    private static class ScoredCandidate {
        MitigationStrategyDTO strategy;
        int suitability;
        String reason;

        ScoredCandidate(MitigationStrategyDTO strategy, int suitability, String reason) {
            this.strategy = strategy;
            this.suitability = suitability;
            this.reason = reason;
        }
    }

    public List<RecommendationDTO> recommendMitigationStrategies(
            WardDTO ward,
            double heatSeverityScore,
            double vulnerabilityScore,
            List<MitigationStrategyDTO> availableStrategies) {

        List<ScoredCandidate> scoredList = new ArrayList<>();

        for (MitigationStrategyDTO strat : availableStrategies) {
            double normCooling = clamp((strat.getCoolingImpactCelsius() / 3.5) * 100.0, 0.0, 100.0);
            double normNeed = (heatSeverityScore * 0.6) + (vulnerabilityScore * 0.4);

            double feasibility = 60.0;
            String specificReason = "";

            String stratId = strat.getId() != null ? strat.getId() : "";
            switch (stratId) {
                case "cool-roofs":
                    if (ward.getMetrics().getBuiltUpPercentage() >= 70.0) {
                        feasibility = 95.0;
                        specificReason = "High built-up density (" + ward.getMetrics().getBuiltUpPercentage() + "%) provides ample flat rooftop surface for fast, non-disruptive thermal reflection.";
                    } else {
                        feasibility = 75.0;
                        specificReason = "Substantial residential roof surfaces allow immediate solar reflectance gains.";
                    }
                    break;
                case "urban-tree-plantation":
                    if (ward.getMetrics().getNdvi() < 0.20) {
                        feasibility = 90.0;
                        specificReason = "Acute vegetation deficit (NDVI " + ward.getMetrics().getNdvi() + ") makes avenue tree plantation critical for restoring pedestrian shading.";
                    } else {
                        feasibility = 70.0;
                        specificReason = "Expansion of street canopy reinforces existing green buffers against heat corridors.";
                    }
                    break;
                case "green-roofs":
                    if (ward.getMetrics().getBuiltUpPercentage() >= 75.0 && ward.getMetrics().getOpenSpacePercentage() < 10.0) {
                        feasibility = 80.0;
                        specificReason = "Limited ground open space (" + ward.getMetrics().getOpenSpacePercentage() + "%) makes vegetated roof infrastructure optimal for localized evapotranspiration.";
                    } else {
                        feasibility = 65.0;
                        specificReason = "Provides high thermal insulation for institutional and commercial buildings.";
                    }
                    break;
                case "urban-parks":
                    if (ward.getMetrics().getOpenSpacePercentage() >= 12.0) {
                        feasibility = 92.0;
                        specificReason = "Sufficient open ground (" + ward.getMetrics().getOpenSpacePercentage() + "%) enables development of dense micro-forests and pocket parks.";
                    } else {
                        feasibility = 45.0;
                        specificReason = "Open ground is scarce (" + ward.getMetrics().getOpenSpacePercentage() + "%), restricting park development to small pocket gardens.";
                    }
                    break;
                case "permeable-pavements":
                    if (ward.getMetrics().getBuiltUpPercentage() >= 65.0) {
                        feasibility = 85.0;
                        specificReason = "Effective retrofitting of sidewalks and parking plazas to eliminate heat trapping without building modifications.";
                    } else {
                        feasibility = 60.0;
                        specificReason = "Reduces stormwater runoff and sensible heat re-radiation across paved walkways.";
                    }
                    break;
                case "blue-infrastructure":
                    if (ward.getId().contains("sakkardara") || ward.getMetrics().getOpenSpacePercentage() >= 14.0) {
                        feasibility = 86.0;
                        specificReason = "Lake proximity or open drainage basins allow water rejuvenation to cast significant evaporative cooling plumes.";
                    } else {
                        feasibility = 50.0;
                        specificReason = "High-impact evaporative cooling best situated near civic squares and park boundaries.";
                    }
                    break;
                case "reflective-roads":
                    if (ward.getMetrics().getBuiltUpPercentage() >= 70.0 && ward.getMetrics().getAlbedo() <= 0.16) {
                        feasibility = 88.0;
                        specificReason = "Low roadway albedo (" + ward.getMetrics().getAlbedo() + ") and heavy traffic corridors make light asphalt coating highly effective.";
                    } else {
                        feasibility = 65.0;
                        specificReason = "Lowers road surface temperature by 8-12°C, suppressing night-time heat island release.";
                    }
                    break;
                default:
                    feasibility = 70.0;
                    specificReason = "General thermal mitigation intervention suited to urban parameters.";
                    break;
            }

            double costFactor = clamp((strat.getCostPerUnitINR() / 2500.0) * 100.0, 10.0, 100.0);
            double rawSuitability = normCooling * 0.35 + normNeed * 0.30 + feasibility * 0.25 - costFactor * 0.10;
            int suitability = (int) Math.round(clamp(rawSuitability, 10.0, 98.0));

            scoredList.add(new ScoredCandidate(strat, suitability, specificReason));
        }

        scoredList.sort(Comparator.comparingInt((ScoredCandidate c) -> c.suitability).reversed());

        List<RecommendationDTO> recommendations = new ArrayList<>();
        int count = Math.min(3, scoredList.size());
        for (int i = 0; i < count; i++) {
            ScoredCandidate item = scoredList.get(i);
            CostEngine.CostEstimate costEst = costEngine.estimateImplementationCost(item.strategy, ward, 0.25);
            CoolingEngine.CoolingEstimate coolEst = coolingEngine.estimateCoolingImpact(item.strategy, ward, 0.25);

            RecommendationDTO rec = new RecommendationDTO(
                    item.strategy,
                    item.suitability,
                    costEst.getCostINR(),
                    costEst.getFormattedCost(),
                    coolEst.getCoolingImpactCelsius(),
                    item.strategy.getImplementationTime(),
                    item.strategy.getMaintenanceLevel(),
                    item.reason,
                    "Recommended based on the prototype scoring model — to be verified with field audits."
            );
            recommendations.add(rec);
        }

        return recommendations;
    }
}
