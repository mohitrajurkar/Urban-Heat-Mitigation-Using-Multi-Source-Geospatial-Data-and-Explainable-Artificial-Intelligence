package com.mohit.urbanheatai.dto;

public class GridCellDTO {
    private String id;
    private int row;
    private int col;
    private double latitude;
    private double longitude;
    private double areaKm2 = 1.0;
    private String wardId;
    private String wardName;
    private double lst;
    private double ndvi;
    private double builtUp;
    private int populationDensity;
    private double albedo;
    private int heatSeverity;
    private String severityLevel;
    private int vulnerability;
    private int priorityScore;
    private String priorityLevel;
    private String recommendedStrategy;
    private String estimatedCostFormatted;
    private double expectedCoolingDrop;
    private String reason;

    public GridCellDTO() {}

    public GridCellDTO(String id, int row, int col, double latitude, double longitude, String wardId, String wardName,
                       double lst, double ndvi, double builtUp, int populationDensity, double albedo,
                       int heatSeverity, String severityLevel, int vulnerability, int priorityScore, String priorityLevel,
                       String recommendedStrategy, String estimatedCostFormatted, double expectedCoolingDrop, String reason) {
        this.id = id;
        this.row = row;
        this.col = col;
        this.latitude = latitude;
        this.longitude = longitude;
        this.areaKm2 = 1.0;
        this.wardId = wardId;
        this.wardName = wardName;
        this.lst = lst;
        this.ndvi = ndvi;
        this.builtUp = builtUp;
        this.populationDensity = populationDensity;
        this.albedo = albedo;
        this.heatSeverity = heatSeverity;
        this.severityLevel = severityLevel;
        this.vulnerability = vulnerability;
        this.priorityScore = priorityScore;
        this.priorityLevel = priorityLevel;
        this.recommendedStrategy = recommendedStrategy;
        this.estimatedCostFormatted = estimatedCostFormatted;
        this.expectedCoolingDrop = expectedCoolingDrop;
        this.reason = reason;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public int getRow() { return row; }
    public void setRow(int row) { this.row = row; }

    public int getCol() { return col; }
    public void setCol(int col) { this.col = col; }

    public double getLatitude() { return latitude; }
    public void setLatitude(double latitude) { this.latitude = latitude; }

    public double getLongitude() { return longitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }

    public double getAreaKm2() { return areaKm2; }
    public void setAreaKm2(double areaKm2) { this.areaKm2 = areaKm2; }

    public String getWardId() { return wardId; }
    public void setWardId(String wardId) { this.wardId = wardId; }

    public String getWardName() { return wardName; }
    public void setWardName(String wardName) { this.wardName = wardName; }

    public double getLst() { return lst; }
    public void setLst(double lst) { this.lst = lst; }

    public double getNdvi() { return ndvi; }
    public void setNdvi(double ndvi) { this.ndvi = ndvi; }

    public double getBuiltUp() { return builtUp; }
    public void setBuiltUp(double builtUp) { this.builtUp = builtUp; }

    public int getPopulationDensity() { return populationDensity; }
    public void setPopulationDensity(int populationDensity) { this.populationDensity = populationDensity; }

    public double getAlbedo() { return albedo; }
    public void setAlbedo(double albedo) { this.albedo = albedo; }

    public int getHeatSeverity() { return heatSeverity; }
    public void setHeatSeverity(int heatSeverity) { this.heatSeverity = heatSeverity; }

    public String getSeverityLevel() { return severityLevel; }
    public void setSeverityLevel(String severityLevel) { this.severityLevel = severityLevel; }

    public int getVulnerability() { return vulnerability; }
    public void setVulnerability(int vulnerability) { this.vulnerability = vulnerability; }

    public int getPriorityScore() { return priorityScore; }
    public void setPriorityScore(int priorityScore) { this.priorityScore = priorityScore; }

    public String getPriorityLevel() { return priorityLevel; }
    public void setPriorityLevel(String priorityLevel) { this.priorityLevel = priorityLevel; }

    public String getRecommendedStrategy() { return recommendedStrategy; }
    public void setRecommendedStrategy(String recommendedStrategy) { this.recommendedStrategy = recommendedStrategy; }

    public String getEstimatedCostFormatted() { return estimatedCostFormatted; }
    public void setEstimatedCostFormatted(String estimatedCostFormatted) { this.estimatedCostFormatted = estimatedCostFormatted; }

    public double getExpectedCoolingDrop() { return expectedCoolingDrop; }
    public void setExpectedCoolingDrop(double expectedCoolingDrop) { this.expectedCoolingDrop = expectedCoolingDrop; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
