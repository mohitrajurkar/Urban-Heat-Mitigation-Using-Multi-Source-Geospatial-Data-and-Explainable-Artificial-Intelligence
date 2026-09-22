package com.mohit.urbanheatai.dto;

import java.util.List;

public class MitigationStrategyDTO {
    private String id;
    private String name;
    private String category;
    private String description;
    private Double costPerUnitINR;
    private String costUnit;
    private Double coolingImpactCelsius;
    private String implementationTime;
    private String maintenanceLevel;
    private String vegetationRequirement;
    private String spaceRequirement;
    private List<String> suitableFor;
    private String prototypeDisclaimer;

    public MitigationStrategyDTO() {}

    public MitigationStrategyDTO(String id, String name, String category, String description,
                                 Double costPerUnitINR, String costUnit, Double coolingImpactCelsius,
                                 String implementationTime, String maintenanceLevel,
                                 String vegetationRequirement, String spaceRequirement,
                                 List<String> suitableFor, String prototypeDisclaimer) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.description = description;
        this.costPerUnitINR = costPerUnitINR;
        this.costUnit = costUnit;
        this.coolingImpactCelsius = coolingImpactCelsius;
        this.implementationTime = implementationTime;
        this.maintenanceLevel = maintenanceLevel;
        this.vegetationRequirement = vegetationRequirement;
        this.spaceRequirement = spaceRequirement;
        this.suitableFor = suitableFor;
        this.prototypeDisclaimer = prototypeDisclaimer;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Double getCostPerUnitINR() { return costPerUnitINR; }
    public void setCostPerUnitINR(Double costPerUnitINR) { this.costPerUnitINR = costPerUnitINR; }

    public String getCostUnit() { return costUnit; }
    public void setCostUnit(String costUnit) { this.costUnit = costUnit; }

    public Double getCoolingImpactCelsius() { return coolingImpactCelsius; }
    public void setCoolingImpactCelsius(Double coolingImpactCelsius) { this.coolingImpactCelsius = coolingImpactCelsius; }

    public String getImplementationTime() { return implementationTime; }
    public void setImplementationTime(String implementationTime) { this.implementationTime = implementationTime; }

    public String getMaintenanceLevel() { return maintenanceLevel; }
    public void setMaintenanceLevel(String maintenanceLevel) { this.maintenanceLevel = maintenanceLevel; }

    public String getVegetationRequirement() { return vegetationRequirement; }
    public void setVegetationRequirement(String vegetationRequirement) { this.vegetationRequirement = vegetationRequirement; }

    public String getSpaceRequirement() { return spaceRequirement; }
    public void setSpaceRequirement(String spaceRequirement) { this.spaceRequirement = spaceRequirement; }

    public List<String> getSuitableFor() { return suitableFor; }
    public void setSuitableFor(List<String> suitableFor) { this.suitableFor = suitableFor; }

    public String getPrototypeDisclaimer() { return prototypeDisclaimer; }
    public void setPrototypeDisclaimer(String prototypeDisclaimer) { this.prototypeDisclaimer = prototypeDisclaimer; }
}
