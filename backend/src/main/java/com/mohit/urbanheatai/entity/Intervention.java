package com.mohit.urbanheatai.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.mohit.urbanheatai.entity.HeatArea;
import jakarta.persistence.*;

@Entity
public class Intervention {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    private String description;

    @JsonIgnore
    @ManyToOne
    private HeatArea heatArea;

    // getters and setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public HeatArea getHeatArea() {
        return heatArea;
    }

    public void setHeatArea(HeatArea heatArea) {
        this.heatArea = heatArea;
    }
}