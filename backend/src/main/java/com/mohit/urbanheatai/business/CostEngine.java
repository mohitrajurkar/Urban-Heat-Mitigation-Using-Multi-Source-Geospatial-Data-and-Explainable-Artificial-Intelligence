package com.mohit.urbanheatai.business;

import com.mohit.urbanheatai.dto.MitigationStrategyDTO;
import com.mohit.urbanheatai.dto.WardDTO;
import org.springframework.stereotype.Component;

import java.text.NumberFormat;
import java.util.Locale;

@Component
public class CostEngine {

    public static class CostEstimate {
        private final long costINR;
        private final String formattedCost;
        private final String disclaimer;

        public CostEstimate(long costINR, String formattedCost, String disclaimer) {
            this.costINR = costINR;
            this.formattedCost = formattedCost;
            this.disclaimer = disclaimer;
        }

        public long getCostINR() { return costINR; }
        public String getFormattedCost() { return formattedCost; }
        public String getDisclaimer() { return disclaimer; }
    }

    public String formatINR(long amount) {
        if (amount >= 10000000L) {
            double cr = (double) amount / 10000000.0;
            return String.format(Locale.US, "₹%.2f Cr", cr);
        }
        if (amount >= 100000L) {
            double lakh = (double) amount / 100000.0;
            return String.format(Locale.US, "₹%.1f Lakh", lakh);
        }
        NumberFormat numFmt = NumberFormat.getNumberInstance(new Locale("en", "IN"));
        return "₹" + numFmt.format(amount);
    }

    public CostEstimate estimateImplementationCost(MitigationStrategyDTO strategy, WardDTO ward, double coverageFraction) {
        double totalWardAreaM2 = ward.getAreaKm2() * 1_000_000.0;
        double targetUnits = 0.0;

        String stratId = strategy.getId() != null ? strategy.getId() : "";
        switch (stratId) {
            case "cool-roofs": {
                double totalRooftopM2 = totalWardAreaM2 * (ward.getMetrics().getBuiltUpPercentage() / 100.0) * 0.30;
                targetUnits = totalRooftopM2 * coverageFraction;
                break;
            }
            case "urban-tree-plantation": {
                double canopyDeficit = Math.max(0.0, (25.0 - ward.getMetrics().getTreeCanopyPercentage()) / 25.0);
                double totalTargetTrees = ward.getAreaKm2() * 1200.0 * canopyDeficit;
                targetUnits = Math.max(150.0, totalTargetTrees * coverageFraction);
                break;
            }
            case "green-roofs": {
                double greenRoofM2 = totalWardAreaM2 * (ward.getMetrics().getBuiltUpPercentage() / 100.0) * 0.08;
                targetUnits = greenRoofM2 * coverageFraction;
                break;
            }
            case "urban-parks": {
                double openGroundM2 = totalWardAreaM2 * (ward.getMetrics().getOpenSpacePercentage() / 100.0) * 0.20;
                targetUnits = Math.max(500.0, openGroundM2 * coverageFraction);
                break;
            }
            case "permeable-pavements": {
                double pavementM2 = totalWardAreaM2 * 0.05;
                targetUnits = pavementM2 * coverageFraction;
                break;
            }
            case "blue-infrastructure": {
                double waterM2 = totalWardAreaM2 * 0.015;
                targetUnits = Math.max(300.0, waterM2 * coverageFraction);
                break;
            }
            case "reflective-roads": {
                double roadM2 = totalWardAreaM2 * 0.07;
                targetUnits = roadM2 * coverageFraction;
                break;
            }
            default: {
                targetUnits = totalWardAreaM2 * 0.05 * coverageFraction;
                break;
            }
        }

        long rawCost = Math.round(targetUnits * strategy.getCostPerUnitINR());
        long costINR = Math.max(1500000L, rawCost);

        return new CostEstimate(costINR, formatINR(costINR), "Prototype estimate — based on modeled spatial area and normative unit schedule.");
    }
}
