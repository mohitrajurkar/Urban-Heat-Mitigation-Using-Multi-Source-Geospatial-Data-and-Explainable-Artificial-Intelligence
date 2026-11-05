package com.urbanheat.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.urbanheat.dto.PageResponse;
import com.urbanheat.dto.ViewDtos.*;
import com.urbanheat.entity.Report;
import com.urbanheat.repository.ReportRepository;
import com.urbanheat.service.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "Recommendations, costs, priorities, reports & settings")
public class PlanningController {
    private final PlanningService planning;
    private final ReportService reports;
    private final SettingsService settings;
    private final AuthService auth;

    @GetMapping("/api/recommendations")
    public PageResponse<RecommendationRow> recommendations(@RequestParam(required = false) Long runId, @RequestParam(required = false) String type,
                                                           @RequestParam(required = false) String priority, @RequestParam(required = false) String search,
                                                           @RequestParam(required = false) String sort, @RequestParam(defaultValue = "0") int page,
                                                           @RequestParam(defaultValue = "25") int size) {
        return planning.list(runId, type, priority, search, sort, page, size);
    }

    @GetMapping("/api/recommendations/summary")
    public Map<String, Object> recommendationSummary(@RequestParam(required = false) Long runId) {
        return planning.summary(runId);
    }

    @GetMapping("/api/recommendations/assumptions")
    @Operation(summary = "Unit costs, cooling coefficients and rules behind every estimate")
    public JsonNode assumptions(@RequestParam(required = false) Long runId) {
        return planning.assumptions(runId);
    }

    @GetMapping("/api/costs/summary")
    public Map<String, Object> costs(@RequestParam(required = false) Long runId) {
        return planning.costSummary(runId);
    }

    @PostMapping("/api/costs/budget-plan")
    @Operation(summary = "Allocate a budget greedily to the most cost-effective interventions")
    public Map<String, Object> budgetPlan(@Valid @RequestBody BudgetPlanRequest req) {
        return planning.budgetPlan(req);
    }

    @GetMapping("/api/priorities")
    public PageResponse<Map<String, Object>> priorities(@RequestParam(required = false) Long runId, @RequestParam(required = false) String level,
                                                        @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "25") int size) {
        return planning.priorities(runId, level, page, size);
    }

    @PostMapping("/api/priorities/recalculate")
    @PreAuthorize("hasAnyRole('ADMIN','ANALYST')")
    @Operation(summary = "Recompute priority scores and ranks with new weights (weights are normalised to sum to 1)")
    public Map<String, Object> recalculate(@RequestParam(required = false) Long runId, @Valid @RequestBody WeightsRequest req) {
        return planning.recalculate(runId, req.toMap());
    }

    @PostMapping("/api/reports")
    @PreAuthorize("hasAnyRole('ADMIN','ANALYST')")
    @Operation(summary = "Generate the analytical PDF report for an analysis run")
    public Map<String, Object> generate(@Valid @RequestBody ReportRequest req) {
        return reports.generate(req, auth.currentUser());
    }

    @GetMapping("/api/reports")
    public List<ReportRepository.ReportSummary> listReports() {
        return reports.list();
    }

    @GetMapping("/api/reports/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long id) {
        Report r = reports.get(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(r.getFileName()).build().toString())
                .contentType(MediaType.APPLICATION_PDF)
                .body(r.getContent());
    }

    @DeleteMapping("/api/reports/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ANALYST')")
    public ResponseEntity<Void> deleteReport(@PathVariable Long id) {
        reports.delete(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/settings")
    public Map<String, Object> getSettings() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("priorityWeights", settings.getPriorityWeights());
        m.put("defaultPriorityWeights", SettingsService.defaultWeights());
        return m;
    }

    @PutMapping("/api/settings/priority-weights")
    @PreAuthorize("hasAnyRole('ADMIN','ANALYST')")
    @Operation(summary = "Save priority weights (applied to new runs; use /api/priorities/recalculate for the current run)")
    public Map<String, Double> setWeights(@Valid @RequestBody WeightsRequest req) {
        return settings.setPriorityWeights(req.toMap());
    }
}
