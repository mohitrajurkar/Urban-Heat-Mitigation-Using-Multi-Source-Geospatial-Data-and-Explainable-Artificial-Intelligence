package com.mohit.urbanheatai.dto;

import java.util.List;

public class WardDTO {
    private String id;
    private String name;
    private String zone;
    private Integer prabhagNo;
    private List<Double> coordinates; // [lat, lng]
    private List<List<Double>> boundaryCoordinates;
    private Double areaKm2;
    private Long population;
    private Double populationDensity;
    private HeatMetricsDTO metrics;
    private VulnerabilityMetricsDTO vulnerability;

    // Derived fields for summaries
    private Double heatSeverityScore;
    private String heatSeverityLevel;
    private Double vulnerabilityScore;
    private String vulnerabilityLevel;
    private Double priorityScore;
    private String priorityLevel;
    private String primaryMitigation;

    public WardDTO() {}

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getZone() { return zone; }
    public void setZone(String zone) { this.zone = zone; }

    public Integer getPrabhagNo() { return prabhagNo; }
    public void setPrabhagNo(Integer prabhagNo) { this.prabhagNo = prabhagNo; }

    public List<Double> getCoordinates() { return coordinates; }
    public void setCoordinates(List<Double> coordinates) { this.coordinates = coordinates; }

    public List<List<Double>> getBoundaryCoordinates() { return boundaryCoordinates; }
    public void setBoundaryCoordinates(List<List<Double>> boundaryCoordinates) { this.boundaryCoordinates = boundaryCoordinates; }

    public Double getAreaKm2() { return areaKm2; }
    public void setAreaKm2(Double areaKm2) { this.areaKm2 = areaKm2; }

    public Long getPopulation() { return population; }
    public void setPopulation(Long population) { this.population = population; }

    public Double getPopulationDensity() { return populationDensity; }
    public void setPopulationDensity(Double populationDensity) { this.populationDensity = populationDensity; }

    public HeatMetricsDTO getMetrics() { return metrics; }
    public void setMetrics(HeatMetricsDTO metrics) { this.metrics = metrics; }

    public VulnerabilityMetricsDTO getVulnerability() { return vulnerability; }
    public void setVulnerability(VulnerabilityMetricsDTO vulnerability) { this.vulnerability = vulnerability; }

    public Double getHeatSeverityScore() { return heatSeverityScore; }
    public void setHeatSeverityScore(Double heatSeverityScore) { this.heatSeverityScore = heatSeverityScore; }

    public String getHeatSeverityLevel() { return heatSeverityLevel; }
    public void setHeatSeverityLevel(String heatSeverityLevel) { this.heatSeverityLevel = heatSeverityLevel; }

    public Double getVulnerabilityScore() { return vulnerabilityScore; }
    public void setVulnerabilityScore(Double vulnerabilityScore) { this.vulnerabilityScore = vulnerabilityScore; }

    public String getVulnerabilityLevel() { return vulnerabilityLevel; }
    public void setVulnerabilityLevel(String vulnerabilityLevel) { this.vulnerabilityLevel = vulnerabilityLevel; }

    public Double getPriorityScore() { return priorityScore; }
    public void setPriorityScore(Double priorityScore) { this.priorityScore = priorityScore; }

    public String getPriorityLevel() { return priorityLevel; }
    public void setPriorityLevel(String priorityLevel) { this.priorityLevel = priorityLevel; }

    public String getPrimaryMitigation() { return primaryMitigation; }
    public void setPrimaryMitigation(String primaryMitigation) { this.primaryMitigation = primaryMitigation; }
}
