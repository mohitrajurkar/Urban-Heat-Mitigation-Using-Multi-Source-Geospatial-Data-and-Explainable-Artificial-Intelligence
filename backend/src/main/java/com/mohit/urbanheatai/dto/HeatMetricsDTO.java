package com.mohit.urbanheatai.dto;

public class HeatMetricsDTO {
    private Double surfaceTemperature;
    private Double ndvi;
    private Double builtUpPercentage;
    private Double albedo;
    private Double openSpacePercentage;
    private Double treeCanopyPercentage;

    public HeatMetricsDTO() {}

    public HeatMetricsDTO(Double surfaceTemperature, Double ndvi, Double builtUpPercentage,
                          Double albedo, Double openSpacePercentage, Double treeCanopyPercentage) {
        this.surfaceTemperature = surfaceTemperature;
        this.ndvi = ndvi;
        this.builtUpPercentage = builtUpPercentage;
        this.albedo = albedo;
        this.openSpacePercentage = openSpacePercentage;
        this.treeCanopyPercentage = treeCanopyPercentage;
    }

    public Double getSurfaceTemperature() { return surfaceTemperature; }
    public void setSurfaceTemperature(Double surfaceTemperature) { this.surfaceTemperature = surfaceTemperature; }

    public Double getNdvi() { return ndvi; }
    public void setNdvi(Double ndvi) { this.ndvi = ndvi; }

    public Double getBuiltUpPercentage() { return builtUpPercentage; }
    public void setBuiltUpPercentage(Double builtUpPercentage) { this.builtUpPercentage = builtUpPercentage; }

    public Double getAlbedo() { return albedo; }
    public void setAlbedo(Double albedo) { this.albedo = albedo; }

    public Double getOpenSpacePercentage() { return openSpacePercentage; }
    public void setOpenSpacePercentage(Double openSpacePercentage) { this.openSpacePercentage = openSpacePercentage; }

    public Double getTreeCanopyPercentage() { return treeCanopyPercentage; }
    public void setTreeCanopyPercentage(Double treeCanopyPercentage) { this.treeCanopyPercentage = treeCanopyPercentage; }
}
