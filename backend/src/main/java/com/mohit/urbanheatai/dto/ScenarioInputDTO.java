package com.mohit.urbanheatai.dto;

import java.util.List;

public class ScenarioInputDTO {
    private String wardId;
    private String strategyId;
    private Integer coveragePercentage;

    public ScenarioInputDTO() {}

    public ScenarioInputDTO(String wardId, String strategyId, Integer coveragePercentage) {
        this.wardId = wardId;
        this.strategyId = strategyId;
        this.coveragePercentage = coveragePercentage;
    }

    public String getWardId() { return wardId; }
    public void setWardId(String wardId) { this.wardId = wardId; }

    public String getStrategyId() { return strategyId; }
    public void setStrategyId(String strategyId) { this.strategyId = strategyId; }

    public Integer getCoveragePercentage() { return coveragePercentage; }
    public void setCoveragePercentage(Integer coveragePercentage) { this.coveragePercentage = coveragePercentage; }
}
