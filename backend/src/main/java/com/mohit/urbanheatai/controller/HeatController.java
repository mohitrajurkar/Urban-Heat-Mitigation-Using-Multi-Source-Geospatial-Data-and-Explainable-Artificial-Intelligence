package com.mohit.urbanheatai.controller;

import com.mohit.urbanheatai.dto.HeatAreaDTO;
import com.mohit.urbanheatai.service.HeatService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
public class HeatController {

    private final HeatService heatService;

    public HeatController(HeatService heatService) {
        this.heatService = heatService;
    }

    // GET all heat areas
    @GetMapping("/heat")
    public List<HeatAreaDTO> getAllHeatAreas() {
        return heatService.getAllHeatAreas();
    }

    // GET heat area by ID
    @GetMapping("/heat/{id}")
    public HeatAreaDTO getHeatArea(@PathVariable Long id) {
        return heatService.getHeatArea(id);
    }

    // CREATE heat area
    @PostMapping("/heat")
    public HeatAreaDTO createHeat(
            @Valid @RequestBody HeatAreaDTO dto) {

        return heatService.createHeat(dto);
    }

    // UPDATE heat area
    @PutMapping("/heat/{id}")
    public HeatAreaDTO updateHeat(
            @PathVariable Long id,
            @Valid @RequestBody HeatAreaDTO dto) {

        return heatService.updateHeat(id, dto);
    }

    // DELETE heat area
    @DeleteMapping("/heat/{id}")
    public ResponseEntity<Void> deleteHeat(@PathVariable Long id) {

        heatService.deleteHeat(id);

        return ResponseEntity
                .status(HttpStatus.NO_CONTENT)
                .build();
    }
}