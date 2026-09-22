package com.mohit.urbanheatai.business;

import com.mohit.urbanheatai.dto.MitigationStrategyDTO;
import com.mohit.urbanheatai.dto.WardDTO;
import org.springframework.stereotype.Component;

@Component
public class CoolingEngine {

    public static class CoolingEstimate {
        private final double coolingImpactCelsius;
        private final String disclaimer;

        public CoolingEstimate(double coolingImpactCelsius, String disclaimer) {
            this.coolingImpactCelsius = coolingImpactCelsius;
            this.disclaimer = disclaimer;
        }

        public double getCoolingImpactCelsius() { return coolingImpactCelsius; }
        public String getDisclaimer() { return disclaimer; }
    }

    public CoolingEstimate estimateCoolingImpact(MitigationStrategyDTO strategy, WardDTO ward, double coverageFraction) {
        double baseCooling = strategy.getCoolingImpactCelsius();

        double climateMultiplier = 1.0;
        if (ward.getMetrics().getSurfaceTemperature() >= 43.0) {
            climateMultiplier += 0.20;
        } else if (ward.getMetrics().getSurfaceTemperature() >= 40.0) {
            climateMultiplier += 0.10;
        }

        if (ward.getMetrics().getNdvi() < 0.15) {
            climateMultiplier += 0.15;
        }

        double coverageScale = Math.pow(coverageFraction / 0.25, 0.55);
        double rawCooling = baseCooling * climateMultiplier * coverageScale;
        double coolingImpactCelsius = Math.round(Math.min(Math.max(rawCooling, 0.6), 4.2) * 10.0) / 10.0;

        return new CoolingEstimate(coolingImpactCelsius, "Prototype estimate — thermal reduction modeled via spatial cooling coefficient.");
    }
}
