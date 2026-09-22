package com.mohit.urbanheatai.business;

import com.mohit.urbanheatai.dto.DecisionResultDTO;
import com.mohit.urbanheatai.dto.MitigationStrategyDTO;
import com.mohit.urbanheatai.dto.WardDTO;
import org.springframework.stereotype.Component;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class ExplanationEngine {

    public DecisionResultDTO.ExplainableFactorsDetails generateFeatureExplanation(
            WardDTO ward,
            DecisionResultDTO.HeatSeverityDetails heatResult,
            DecisionResultDTO.VulnerabilityDetails vulnResult,
            MitigationStrategyDTO topStrategy) {

        List<String> whyHighPriority = new ArrayList<>();
        NumberFormat numFmt = NumberFormat.getNumberInstance(Locale.US);

        if (ward.getMetrics().getSurfaceTemperature() >= 42.0) {
            whyHighPriority.add("Elevated Land Surface Temperature of " + ward.getMetrics().getSurfaceTemperature() + "°C exceeds municipal safe threshold.");
        }

        if (ward.getMetrics().getBuiltUpPercentage() >= 75.0) {
            whyHighPriority.add("Impervious built-up surface is " + ward.getMetrics().getBuiltUpPercentage() + "%, triggering high thermal mass retention.");
        }

        if (ward.getMetrics().getNdvi() <= 0.18) {
            whyHighPriority.add("Severe vegetative deficit with NDVI of " + ward.getMetrics().getNdvi() + " indicates acute absence of evaporative cooling.");
        }

        if (ward.getPopulationDensity() >= 18000) {
            whyHighPriority.add("Dense population exposure with " + numFmt.format(ward.getPopulationDensity().intValue()) + " citizens/km² in immediate danger zone.");
        }

        if (ward.getVulnerability().getVulnerableDemographicPercentage() >= 20.0) {
            whyHighPriority.add("High demographic sensitivity: " + ward.getVulnerability().getVulnerableDemographicPercentage() + "% are children under 5 or elderly over 65.");
        }

        if (whyHighPriority.isEmpty()) {
            whyHighPriority.add("Localized microclimate demonstrates moderate heat elevation (" + ward.getMetrics().getSurfaceTemperature() + "°C) with balanced canopy.");
        }

        String whyStrategyRecommended = "";
        if (topStrategy != null) {
            String id = topStrategy.getId() != null ? topStrategy.getId() : "";
            switch (id) {
                case "cool-roofs":
                    whyStrategyRecommended = "Cool roofs receive high suitability (" + ward.getMetrics().getBuiltUpPercentage() + "% built-up area) as horizontal rooftop expanse can be retrofitted without requiring scarce ground parcel acquisitions.";
                    break;
                case "urban-tree-plantation":
                    whyStrategyRecommended = "Tree plantation is strongly favored due to acute vegetation deficit (NDVI " + ward.getMetrics().getNdvi() + ") and street corridor availability to create continuous pedestrian shade.";
                    break;
                case "green-roofs":
                    whyStrategyRecommended = "Vegetated green roofs maximize insulation for concrete buildings while contributing biological transpiration in densely packed blocks.";
                    break;
                case "urban-parks":
                    whyStrategyRecommended = "Urban pocket parks are recommended to address the critical " + ward.getVulnerability().getGreenSpaceDeficitPercentage() + "% green space deficit and establish cold-island anchor zones.";
                    break;
                case "permeable-pavements":
                    whyStrategyRecommended = "Permeable pavements are prioritized to mitigate ground heat re-radiation and improve storm-water retention across high-traffic footpaths.";
                    break;
                case "blue-infrastructure":
                    whyStrategyRecommended = "Water bodies and evaporative features provide high-intensity localized cooling plumes across congested civic areas.";
                    break;
                case "reflective-roads":
                    whyStrategyRecommended = "Reflective road coatings are ideal for high-traffic corridors with low albedo (" + ward.getMetrics().getAlbedo() + ") where vehicular friction exacerbates the thermal envelope.";
                    break;
                default:
                    whyStrategyRecommended = topStrategy.getName() + " yields the optimal balance of immediate cooling drop and spatial feasibility for " + ward.getName() + ".";
                    break;
            }
        } else {
            whyStrategyRecommended = "Interventions prioritized based on multi-criteria cooling efficiency, spatial feasibility, and capital requirements.";
        }

        String title = "Explainable Decision Factors";
        String note = "Prototype explainability layer. SHAP-based explanations will be integrated with the ML model in a later phase.";

        return new DecisionResultDTO.ExplainableFactorsDetails(title, whyHighPriority, whyStrategyRecommended, note);
    }
}
