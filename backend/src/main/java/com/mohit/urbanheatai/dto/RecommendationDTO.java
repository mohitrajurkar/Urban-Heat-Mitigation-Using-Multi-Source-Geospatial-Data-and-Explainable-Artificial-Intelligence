package com.mohit.urbanheatai.dto;

public class RecommendationDTO {
    private MitigationStrategyDTO strategy;
    private Integer suitabilityScore;
    private Long estimatedCostINR;
    private String estimatedCostFormatted;
    private Double expectedCoolingDrop;
    private String implementationTime;
    private String maintenanceLevel;
    private String reason;
    private String disclaimer;

    public RecommendationDTO() {}

    public RecommendationDTO(MitigationStrategyDTO strategy, Integer suitabilityScore,
                             Long estimatedCostINR, String estimatedCostFormatted,
                             Double expectedCoolingDrop, String implementationTime,
                             String maintenanceLevel, String reason, String disclaimer) {
        this.strategy = strategy;
        this.suitabilityScore = suitabilityScore;
        this.estimatedCostINR = estimatedCostINR;
        this.estimatedCostFormatted = estimatedCostFormatted;
        this.expectedCoolingDrop = expectedCoolingDrop;
        this.implementationTime = implementationTime;
        this.maintenanceLevel = maintenanceLevel;
        this.reason = reason;
        this.disclaimer = disclaimer;
    }

    public MitigationStrategyDTO getStrategy() { return strategy; }
    public void setStrategy(MitigationStrategyDTO strategy) { this.strategy = strategy; }

    public Integer getSuitabilityScore() { return suitabilityScore; }
    public void setSuitabilityScore(Integer suitabilityScore) { this.suitabilityScore = suitabilityScore; }

    public Long getEstimatedCostINR() { return estimatedCostINR; }
    public void setEstimatedCostINR(Long estimatedCostINR) { this.estimatedCostINR = estimatedCostINR; }

    public String getEstimatedCostFormatted() { return estimatedCostFormatted; }
    public void setEstimatedCostFormatted(String estimatedCostFormatted) { this.estimatedCostFormatted = estimatedCostFormatted; }

    public Double getExpectedCoolingDrop() { return expectedCoolingDrop; }
    public void setExpectedCoolingDrop(Double expectedCoolingDrop) { this.expectedCoolingDrop = expectedCoolingDrop; }

    public String getImplementationTime() { return implementationTime; }
    public void setImplementationTime(String implementationTime) { this.implementationTime = implementationTime; }

    public String getMaintenanceLevel() { return maintenanceLevel; }
    public void setMaintenanceLevel(String maintenanceLevel) { this.maintenanceLevel = maintenanceLevel; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getDisclaimer() { return disclaimer; }
    public void setDisclaimer(String disclaimer) { this.disclaimer = disclaimer; }
}
