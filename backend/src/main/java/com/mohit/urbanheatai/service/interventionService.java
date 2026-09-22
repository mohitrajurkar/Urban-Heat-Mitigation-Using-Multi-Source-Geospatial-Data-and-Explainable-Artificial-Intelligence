package com.mohit.urbanheatai.service;

import com.mohit.urbanheatai.dto.InterventionDTO;
import com.mohit.urbanheatai.entity.HeatArea;
import com.mohit.urbanheatai.entity.Intervention;
import com.mohit.urbanheatai.exception.HeatAreaNotFoundException;
import com.mohit.urbanheatai.mapper.InterventionMapper;
import com.mohit.urbanheatai.repository.HeatRepository;
import com.mohit.urbanheatai.repository.InterventionRepository;
import org.springframework.stereotype.Service;

@Service
public class interventionService {

    private final InterventionRepository interventionRepository;
    private final HeatRepository heatRepository;
    private final InterventionMapper interventionMapper;

    public interventionService(
            InterventionRepository interventionRepository,
            HeatRepository heatRepository,
            InterventionMapper interventionMapper
    ) {
        this.interventionRepository = interventionRepository;
        this.heatRepository = heatRepository;
        this.interventionMapper = interventionMapper;
    }

    public InterventionDTO createIntervention(InterventionDTO dto) {

        HeatArea heatArea = heatRepository.findById(dto.getHeatAreaId())
                .orElseThrow(() ->
                        new HeatAreaNotFoundException("Heat area not found")
                );

        Intervention intervention = interventionMapper.toEntity(dto);

        intervention.setHeatArea(heatArea);

        Intervention savedIntervention =
                interventionRepository.save(intervention);

        return interventionMapper.toDTO(savedIntervention);
    }
}