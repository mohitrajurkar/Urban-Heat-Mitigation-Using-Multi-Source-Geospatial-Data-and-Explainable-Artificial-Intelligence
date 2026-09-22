package com.mohit.urbanheatai.mapper;

import com.mohit.urbanheatai.dto.InterventionDTO;
import com.mohit.urbanheatai.entity.Intervention;
import org.springframework.stereotype.Component;

@Component
public class InterventionMapper {

    public InterventionDTO toDTO(Intervention intervention) {

        InterventionDTO dto = new InterventionDTO();

        dto.setName(intervention.getName());
        dto.setDescription(intervention.getDescription());

        if (intervention.getHeatArea() != null) {
            dto.setHeatAreaId(intervention.getHeatArea().getId());
        }

        return dto;
    }

    public Intervention toEntity(InterventionDTO dto) {

        Intervention intervention = new Intervention();

        intervention.setName(dto.getName());
        intervention.setDescription(dto.getDescription());

        return intervention;
    }
}