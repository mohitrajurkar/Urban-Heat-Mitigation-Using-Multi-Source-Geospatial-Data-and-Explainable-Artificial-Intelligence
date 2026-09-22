package com.mohit.urbanheatai.controller;

import com.mohit.urbanheatai.dto.*;
import com.mohit.urbanheatai.service.WardDecisionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class WardDecisionController {

    private final WardDecisionService decisionService;
    private final com.mohit.urbanheatai.client.AiServiceClient aiServiceClient;

    public WardDecisionController(WardDecisionService decisionService,
                                  com.mohit.urbanheatai.client.AiServiceClient aiServiceClient) {
        this.decisionService = decisionService;
        this.aiServiceClient = aiServiceClient;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> getHealth() {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("status", "UP");
        resp.put("service", "Urban Heat Mitigation Decision Support System (Spring Boot Java Backend)");
        resp.put("timestamp", Instant.now().toString());
        resp.put("mode", "Prototype Mode");
        resp.put("aiServiceHealth", aiServiceClient.checkHealth());
        resp.put("notice", "Data shown for demonstration. Real satellite (Landsat/Sentinel) and validated cost models integrate in Phase 2.");
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/ai-status")
    public ResponseEntity<Map<String, Object>> getAiStatus() {
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("aiService", aiServiceClient.checkHealth());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/wards")
    public ResponseEntity<Map<String, Object>> getAllWards() {
        List<WardDTO> wards = decisionService.getAllWardsWithSummary();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("count", wards.size());
        resp.put("data", wards);
        resp.put("mode", "Prototype Mode (Java Spring Boot)");
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/wards/{id}")
    public ResponseEntity<?> getWardById(@PathVariable String id) {
        WardDTO ward = decisionService.getWardById(id);
        if (ward == null) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("success", false);
            err.put("error", "Ward not found: " + id);
            return ResponseEntity.status(404).body(err);
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("data", ward);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/wards/{id}/analysis")
    public ResponseEntity<?> getWardAnalysis(@PathVariable String id) {
        DecisionResultDTO analysis = decisionService.getWardAnalysis(id);
        if (analysis == null) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("success", false);
            err.put("error", "Ward not found: " + id);
            return ResponseEntity.status(404).body(err);
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("data", analysis);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/wards/{id}/recommendations")
    public ResponseEntity<?> getWardRecommendations(@PathVariable String id) {
        List<RecommendationDTO> recs = decisionService.getWardRecommendations(id);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("data", recs);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/strategies")
    public ResponseEntity<Map<String, Object>> getAllStrategies() {
        List<MitigationStrategyDTO> strategies = decisionService.getAllStrategies();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("count", strategies.size());
        resp.put("data", strategies);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/grid-cells")
    public ResponseEntity<Map<String, Object>> getGridCells(@RequestParam(required = false) String city) {
        List<GridCellDTO> cells = decisionService.getAllGridCells();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("count", cells.size());
        resp.put("resolution", "1 km x 1 km");
        resp.put("city", city != null ? city : "nagpur");
        resp.put("data", cells);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/grid-cells/{id}")
    public ResponseEntity<?> getGridCellById(@PathVariable String id) {
        GridCellDTO cell = decisionService.getGridCellById(id);
        if (cell == null) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("success", false);
            err.put("error", "Grid cell not found: " + id);
            return ResponseEntity.status(404).body(err);
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("data", cell);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/scenario/analyze")
    public ResponseEntity<?> postScenarioAnalyze(@RequestBody ScenarioInputDTO input) {
        if (input.getWardId() == null || input.getStrategyId() == null || input.getCoveragePercentage() == null) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("success", false);
            err.put("error", "Missing required fields: wardId, strategyId, coveragePercentage");
            return ResponseEntity.badRequest().body(err);
        }

        ScenarioResultDTO result = decisionService.analyzeScenario(input);
        if (result == null) {
            Map<String, Object> err = new LinkedHashMap<>();
            err.put("success", false);
            err.put("error", "Ward not found for scenario: " + input.getWardId());
            return ResponseEntity.status(404).body(err);
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("success", true);
        resp.put("data", result);
        return ResponseEntity.ok(resp);
    }
}
