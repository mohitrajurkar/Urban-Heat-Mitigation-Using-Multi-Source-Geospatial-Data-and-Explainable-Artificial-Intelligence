package com.urbanheat.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.urbanheat.dto.PageResponse;
import com.urbanheat.dto.ViewDtos.*;
import com.urbanheat.service.DashboardService;
import com.urbanheat.service.InsightService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/** runId is optional everywhere: omitted = latest completed analysis run. */
@RestController
@RequiredArgsConstructor
@Tag(name = "Dashboard, indicators, GIS, hotspots, predictions & explanations")
public class InsightController {
    private final InsightService insight;
    private final DashboardService dashboard;

    @GetMapping("/api/dashboard/stats")
    @Operation(summary = "KPIs and chart data for the dashboard")
    public Map<String, Object> dashboard(@RequestParam(required = false) Long runId) {
        return dashboard.stats(runId);
    }

    @GetMapping("/api/indicators/summary")
    public Map<String, Object> indicatorSummary(@RequestParam(required = false) Long runId) {
        return insight.indicatorSummary(runId);
    }

    @GetMapping("/api/indicators")
    public PageResponse<IndicatorRow> indicators(@RequestParam(required = false) Long runId, @RequestParam(required = false) String search,
                                                 @RequestParam(required = false) String lulc, @RequestParam(required = false) String sort,
                                                 @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return insight.indicatorRows(runId, search, lulc, sort, page, size);
    }

    @GetMapping(value = "/api/map/regions", produces = "application/geo+json")
    @Operation(summary = "All analysis regions as GeoJSON with indicators, severity, predictions and priority")
    public ObjectNode regions(@RequestParam(required = false) Long runId) {
        return insight.regionsGeoJson(runId);
    }

    @GetMapping("/api/map/layers")
    public JsonNode layers(@RequestParam(required = false) Long runId) {
        return insight.layers(runId);
    }

    @GetMapping(value = "/api/map/layers/{layer}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> layerPng(@PathVariable String layer, @RequestParam(required = false) Long runId) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1))).contentType(MediaType.IMAGE_PNG).body(insight.layerPng(runId, layer));
    }

    @GetMapping("/api/map/interventions")
    public List<Map<String, Object>> interventions(@RequestParam(required = false) Long runId) {
        return insight.interventionMarkers(runId);
    }

    @GetMapping("/api/hotspots")
    public PageResponse<HotspotRow> hotspots(@RequestParam(required = false) Long runId, @RequestParam(required = false) String severity,
                                             @RequestParam(required = false) String search, @RequestParam(defaultValue = "false") boolean significantOnly,
                                             @RequestParam(defaultValue = "false") boolean includeAll, @RequestParam(required = false) String priorityLevel,
                                             @RequestParam(required = false) String sort, @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "25") int size) {
        return insight.hotspotRows(runId, severity, search, significantOnly, includeAll, priorityLevel, sort, page, size);
    }

    @GetMapping("/api/hotspots/{id}")
    @Operation(summary = "Hotspot detail: indicators, predictions, SHAP explanation, priority breakdown and recommendations")
    public Map<String, Object> hotspot(@PathVariable Long id) {
        return insight.hotspotDetail(id);
    }

    @GetMapping("/api/regions/{regionId}")
    public Map<String, Object> region(@PathVariable Long regionId) {
        return insight.regionDetail(regionId);
    }

    @GetMapping("/api/predictions/evaluation")
    @Operation(summary = "Random Forest vs XGBoost evaluation metrics, confusion matrices and feature importance")
    public Map<String, Object> evaluation(@RequestParam(required = false) Long runId) {
        return insight.evaluation(runId);
    }

    @GetMapping("/api/predictions")
    public PageResponse<PredictionRow> predictions(@RequestParam(required = false) Long runId, @RequestParam(required = false) String search,
                                                   @RequestParam(required = false) String predictedClass,
                                                   @RequestParam(defaultValue = "false") boolean disagreementsOnly,
                                                   @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return insight.predictionRows(runId, search, predictedClass, disagreementsOnly, page, size);
    }

    @PostMapping("/api/predictions/custom")
    @Operation(summary = "Predict heat severity and LST for custom feature values, with SHAP explanation")
    public JsonNode custom(@RequestParam(required = false) Long runId, @RequestBody JsonNode body) {
        return insight.customPrediction(runId, body.has("features") ? body.get("features") : body);
    }

    @GetMapping("/api/explanations/global")
    public JsonNode shapGlobal(@RequestParam(required = false) Long runId) {
        return insight.shapGlobal(runId);
    }

    @GetMapping("/api/explanations/regions/{regionId}")
    public LocalExplanationDto regionExplanation(@PathVariable Long regionId) {
        return insight.regionExplanation(regionId);
    }

    @GetMapping(value = "/api/explanations/plots/{model}/{task}.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> shapPlot(@PathVariable String model, @PathVariable String task, @RequestParam(required = false) Long runId) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofHours(1))).contentType(MediaType.IMAGE_PNG).body(insight.shapPlot(runId, model, task));
    }
}
