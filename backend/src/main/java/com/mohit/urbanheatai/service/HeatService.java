package com.mohit.urbanheatai.service;

import com.mohit.urbanheatai.config.AppProperties;
import com.mohit.urbanheatai.dto.HeatAreaDTO;
import com.mohit.urbanheatai.entity.HeatArea;
import com.mohit.urbanheatai.exception.HeatAreaNotFoundException;
import com.mohit.urbanheatai.mapper.HeatAreaMapper;
import com.mohit.urbanheatai.repository.HeatRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.List;


@Service
public class HeatService {

    private static final Logger logger = LoggerFactory.getLogger(HeatService.class);
    private final HeatRepository heatRepository;
    private final HeatAreaMapper heatAreaMapper;
    private final AppProperties appProperties;


    public HeatService(
            HeatRepository heatRepository,
            HeatAreaMapper heatAreaMapper, AppProperties appProperties
    ) {
        this.heatRepository = heatRepository;
        this.heatAreaMapper = heatAreaMapper;
        this.appProperties = appProperties;
    }

    // GET /heat/{id}
    public HeatAreaDTO getHeatArea(Long id) {

        logger.info("getting HeatArea by id {}", id);

        HeatArea heatArea = heatRepository.findById(id)
                .orElseThrow(() -> {
                    logger.warn("HeatArea not found with id {}", id);
                    return new HeatAreaNotFoundException("Heat area not found");
                });

        return heatAreaMapper.toDTO(heatArea);
    }

    // GET /heat
    public List<HeatAreaDTO> getAllHeatAreas() {

        return heatRepository.findAll()
                .stream()
                .map(heatAreaMapper::toDTO)
                .toList();
    }

    // POST /heat
    public HeatAreaDTO createHeat(HeatAreaDTO dto) {

        logger.info("Application Name: {}",appProperties.getName());
        logger.debug("Received HeatArea DTO: {}", dto);

        // DTO → Entity
        HeatArea heatArea = heatAreaMapper.toEntity(dto);

        // Save Entity
        HeatArea savedHeatArea = heatRepository.save(heatArea);

        logger.info("HeatArea created successfully with id: {}", savedHeatArea.getId());

        // Entity → DTO
        return heatAreaMapper.toDTO(savedHeatArea);
    }

    // PUT /heat/{id}
    public HeatAreaDTO updateHeat(Long id, HeatAreaDTO dto) {

        HeatArea existing = heatRepository.findById(id)
                .orElseThrow(() ->
                        new HeatAreaNotFoundException("Heat area not found")
                );

        existing.setLatitude(dto.getLatitude());
        existing.setLongitude(dto.getLongitude());
        existing.setTemperature(dto.getTemperature());

        HeatArea updatedHeatArea = heatRepository.save(existing);

        return heatAreaMapper.toDTO(updatedHeatArea);
    }

    // DELETE /heat/{id}
    public void deleteHeat(Long id) {

        HeatArea heatArea = heatRepository.findById(id)
                .orElseThrow(() -> {
                    logger.warn("HeatArea not found with id {}", id);
                    return new HeatAreaNotFoundException("Heat area not found");
                });

        heatRepository.delete(heatArea);

        logger.info("HeatArea deleted successfully with id: {}", id);

    }

}