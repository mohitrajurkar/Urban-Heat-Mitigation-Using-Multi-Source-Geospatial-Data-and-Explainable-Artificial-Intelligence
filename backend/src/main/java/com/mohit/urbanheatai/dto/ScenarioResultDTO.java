package com.mohit.urbanheatai.dto;

import java.util.List;

public class ScenarioResultDTO {
    private String wardId;
    private String wardName;
    private String strategyName;
    private Integer coveragePercentage;
    private Long estimatedCostINR;
    private String estimatedCostFormatted;
    private Double expectedCoolingCelsius;
    private Long affectedPopulationBenefited;
    private Double baselinePriorityScore;
    private Double projectedPriorityScore;
    private Double priorityReductionPoints;
    private List<String> coBenefits;

    public ScenarioResultDTO() {}

    public String getWardId() { return wardId; }
    public void setWardId(String wardId) { this.wardId = wardId; }

    public String getWardName() { return wardName; }
    public void setWardName(String wardName) { this.wardName = wardName; }

    public String getStrategyName() { return strategyName; }
    public void setStrategyName(String strategyName) { this.strategyName = strategyName; }

    public Integer getCoveragePercentage() { return coveragePercentage; }
    public void setCoveragePercentage(Integer coveragePercentage) { this.coveragePercentage = coveragePercentage; }

    public Long getEstimatedCostINR() { return estimatedCostINR; }
    public void setEstimatedCostINR(Long estimatedCostINR) { this.estimatedCostINR = estimatedCostINR; }

    public String getEstimatedCostFormatted() { return estimatedCostFormatted; }
    public void setEstimatedCostFormatted(String estimatedCostFormatted) { this.estimatedCostFormatted = estimatedCostFormatted; }

    public Double getExpectedCoolingCelsius() { return expectedCoolingCelsius; }
    public void setExpectedCoolingCelsius(Double expectedCoolingCelsius) { this.expectedCoolingCelsius = expectedCoolingCelsius; }

    public Long getAffectedPopulationBenefited() { return affectedPopulationBenefited; }
    public void setAffectedPopulationBenefited(Long affectedPopulationBenefited) { this.affectedPopulationBenefited = affectedPopulationBenefited; }

    public Double getBaselinePriorityScore() { return baselinePriorityScore; }
    public void setBaselinePriorityScore(Double baselinePriorityScore) { this.baselinePriorityScore = baselinePriorityScore; }

    public Double getProjectedPriorityScore() { return projectedPriorityScore; }
    public void setProjectedPriorityScore(Double projectedPriorityScore) { this.projectedPriorityScore = projectedPriorityScore; }

    public Double getPriorityReductionPoints() { return priorityReductionPoints; }
    public void setPriorityReductionPoints(Double priorityReductionPoints) { this.priorityReductionPoints = priorityReductionPoints; }

    public List<String> getCoBenefits() { return coBenefits; }
    public void setCoBenefits(List<String> coBenefits) { this.coBenefits = coBenefits; }
}
