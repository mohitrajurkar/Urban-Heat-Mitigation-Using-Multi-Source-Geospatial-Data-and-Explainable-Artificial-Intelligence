package com.mohit.urbanheatai.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class InterventionDTO {

    @NotBlank
    private String name;

    @NotBlank
    private String description;

    @NotNull
    private Long heatAreaId;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Long getHeatAreaId() {
        return heatAreaId;
    }

    public void setHeatAreaId(Long heatAreaId) {
        this.heatAreaId = heatAreaId;
    }
}