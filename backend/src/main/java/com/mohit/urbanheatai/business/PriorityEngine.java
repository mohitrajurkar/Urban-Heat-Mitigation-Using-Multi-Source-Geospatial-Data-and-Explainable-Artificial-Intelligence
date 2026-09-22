package com.mohit.urbanheatai.business;

import com.mohit.urbanheatai.dto.DecisionResultDTO;
import com.mohit.urbanheatai.dto.WardDTO;
import org.springframework.stereotype.Component;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class PriorityEngine {

    private double clamp(double val, double min, double max) {
        return Math.max(min, Math.min(max, val));
    }

    public DecisionResultDTO.PriorityDetails calculatePriorityScore(double heatSeverityScore, double vulnerabilityScore, WardDTO ward) {
        double rawScore = heatSeverityScore * 0.60 + vulnerabilityScore * 0.40;
        double score = Math.round(clamp(rawScore, 0.0, 100.0) * 10.0) / 10.0;

        String level = "Low";
        if (score >= 72.0) {
            level = "Critical";
        } else if (score >= 52.0) {
            level = "High";
        } else if (score >= 32.0) {
            level = "Moderate";
        }

        List<String> statements = new ArrayList<>();
        NumberFormat numFmt = NumberFormat.getNumberInstance(Locale.US);

        if (ward.getMetrics().getSurfaceTemperature() >= 43.0) {
            statements.add("Extreme land surface temperature (" + ward.getMetrics().getSurfaceTemperature() + "°C)");
        } else if (ward.getMetrics().getSurfaceTemperature() >= 40.0) {
            statements.add("Elevated surface temperature (" + ward.getMetrics().getSurfaceTemperature() + "°C)");
        } else {
            statements.add("Moderate surface temperature (" + ward.getMetrics().getSurfaceTemperature() + "°C)");
        }

        if (ward.getMetrics().getNdvi() < 0.15) {
            statements.add("severe vegetation deficit (NDVI " + ward.getMetrics().getNdvi() + ")");
        } else if (ward.getMetrics().getNdvi() < 0.25) {
            statements.add("sparse vegetative cover (NDVI " + ward.getMetrics().getNdvi() + ")");
        }

        if (ward.getMetrics().getBuiltUpPercentage() >= 80.0) {
            statements.add("dense concrete imperviousness (" + ward.getMetrics().getBuiltUpPercentage() + "%)");
        }

        if (ward.getPopulationDensity() >= 20000) {
            statements.add("high population exposure (" + numFmt.format(ward.getPopulationDensity().intValue()) + " people/km²)");
        }

        String reason;
        if (statements.size() > 1) {
            StringBuilder sb = new StringBuilder(statements.get(0));
            sb.append(" combined with ");
            for (int i = 1; i < statements.size(); i++) {
                if (i > 1) sb.append(" and ");
                sb.append(statements.get(i));
            }
            sb.append(".");
            reason = sb.toString();
        } else {
            reason = statements.get(0) + " under current urban canopy conditions.";
        }

        return new DecisionResultDTO.PriorityDetails(score, level, reason);
    }
}
