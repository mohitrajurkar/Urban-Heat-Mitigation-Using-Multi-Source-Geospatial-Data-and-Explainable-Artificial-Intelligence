package com.mohit.urbanheatai.mapper;

import com.mohit.urbanheatai.dto.HeatAreaDTO;
import com.mohit.urbanheatai.dto.InterventionDTO;
import com.mohit.urbanheatai.entity.HeatArea;
import com.mohit.urbanheatai.entity.Intervention;
import org.springframework.stereotype.Component;

@Component
public class HeatAreaMapper {

    private Object toDTO;

    public HeatAreaDTO toDTO(HeatArea heatArea) {

        HeatAreaDTO dto = new HeatAreaDTO();

        dto.setLatitude(heatArea.getLatitude());
        dto.setLongitude(heatArea.getLongitude());
        dto.setTemperature(heatArea.getTemperature());

        dto.setInterventions(
                heatArea.getInterventions()
                        .stream()
                        .map(this::toDTO)
                        .toList()
        );

        return dto;
    }

    // DTO → Entity
    public HeatArea toEntity(HeatAreaDTO dto) {

        HeatArea heatArea = new HeatArea();

        heatArea.setLatitude(dto.getLatitude());
        heatArea.setLongitude(dto.getLongitude());
        heatArea.setTemperature(dto.getTemperature());

        return heatArea;
    }

    public InterventionDTO toDTO(Intervention intervention) {

        InterventionDTO dto = new InterventionDTO();

        dto.setName(intervention.getName());
        dto.setDescription(intervention.getDescription());

        if (intervention.getHeatArea() != null) {
            dto.setHeatAreaId(intervention.getHeatArea().getId());
        }

        return dto;
    }
}