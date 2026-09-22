package com.mohit.urbanheatai.controller;

import com.mohit.urbanheatai.dto.InterventionDTO;
import com.mohit.urbanheatai.service.interventionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class InterventionController {

    private final interventionService interventionService;

    public InterventionController(interventionService interventionService) {
        this.interventionService = interventionService;
    }

    @PostMapping("/intervention")
    public ResponseEntity<InterventionDTO> createIntervention(
            @Valid @RequestBody InterventionDTO dto) {

        InterventionDTO createdIntervention =
                interventionService.createIntervention(dto);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(createdIntervention);
    }


}