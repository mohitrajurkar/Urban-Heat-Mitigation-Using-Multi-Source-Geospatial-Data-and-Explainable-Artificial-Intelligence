package com.mohit.urbanheatai.business;

import com.mohit.urbanheatai.dto.DecisionResultDTO;
import com.mohit.urbanheatai.dto.HeatMetricsDTO;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class ScoringEngine {

    // Configurable prototype weights
    public static final double WEIGHT_TEMPERATURE = 0.40;
    public static final double WEIGHT_BUILT_UP = 0.20;
    public static final double WEIGHT_VEGETATION = 0.20;
    public static final double WEIGHT_POP_DENSITY = 0.10;
    public static final double WEIGHT_ALBEDO = 0.10;

    private double clamp(double val, double min, double max) {
        return Math.max(min, Math.min(max, val));
    }

    public DecisionResultDTO.HeatSeverityDetails calculateHeatSeverity(HeatMetricsDTO metrics, double populationDensity) {
        // 1. Normalized Temperature Factor (30°C baseline = 0, 48°C extreme = 100)
        double normTemp = clamp((metrics.getSurfaceTemperature() - 30.0) / (48.0 - 30.0), 0.0, 1.0) * 100.0;

        // 2. Built-up percentage Factor (0% = 0, 100% = 100)
        double normBuiltUp = clamp(metrics.getBuiltUpPercentage(), 0.0, 100.0);

        // 3. Low Vegetation Factor (NDVI 0.75 = 0, NDVI 0.0 = 100)
        double normVegetation = (1.0 - clamp(metrics.getNdvi() / 0.75, 0.0, 1.0)) * 100.0;

        // 4. Population Density Factor (0 = 0, 30,000/sq.km = 100)
        double normPopDensity = clamp(populationDensity / 30000.0, 0.0, 1.0) * 100.0;

        // 5. Low Albedo Factor (Albedo 0.35 = 0, Albedo 0.08 = 100)
        double normAlbedo = (1.0 - clamp((metrics.getAlbedo() - 0.08) / (0.35 - 0.08), 0.0, 1.0)) * 100.0;

        double rawScore = normTemp * WEIGHT_TEMPERATURE +
                          normBuiltUp * WEIGHT_BUILT_UP +
                          normVegetation * WEIGHT_VEGETATION +
                          normPopDensity * WEIGHT_POP_DENSITY +
                          normAlbedo * WEIGHT_ALBEDO;

        double score = Math.round(clamp(rawScore, 0.0, 100.0) * 10.0) / 10.0;

        String level = "Low";
        if (score >= 75.0) {
            level = "Critical";
        } else if (score >= 55.0) {
            level = "High";
        } else if (score >= 35.0) {
            level = "Moderate";
        }

        Map<String, Double> breakdown = new LinkedHashMap<>();
        breakdown.put("temperatureFactor", Math.round(normTemp * 10.0) / 10.0);
        breakdown.put("builtUpFactor", Math.round(normBuiltUp * 10.0) / 10.0);
        breakdown.put("vegetationFactor", Math.round(normVegetation * 10.0) / 10.0);
        breakdown.put("populationFactor", Math.round(normPopDensity * 10.0) / 10.0);
        breakdown.put("albedoFactor", Math.round(normAlbedo * 10.0) / 10.0);

        String modelNote = "Prototype weighted scoring model (40% Temp + 20% Built-up + 20% Low Veg + 10% Pop Density + 10% Low Albedo)";

        return new DecisionResultDTO.HeatSeverityDetails(score, level, breakdown, modelNote);
    }
}
