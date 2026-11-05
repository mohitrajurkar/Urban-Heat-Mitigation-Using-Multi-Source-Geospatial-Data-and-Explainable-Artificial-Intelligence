package com.urbanheat.controller;

import com.urbanheat.dto.AnalysisDtos.RunResponse;
import com.urbanheat.dto.AnalysisDtos.StartAnalysisRequest;
import com.urbanheat.dto.ViewDtos.DatasetDto;
import com.urbanheat.dto.ViewDtos.StudyAreaDto;
import com.urbanheat.exception.ApiException;
import com.urbanheat.repository.StudyAreaRepository;
import com.urbanheat.service.AnalysisService;
import com.urbanheat.service.AuthService;
import com.urbanheat.service.DatasetService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "Study areas, datasets & analysis runs")
public class DataController {
    private final StudyAreaRepository studyAreas;
    private final DatasetService datasets;
    private final AnalysisService analysis;
    private final AuthService auth;

    @GetMapping("/api/study-areas")
    @Transactional(readOnly = true)
    public List<StudyAreaDto> studyAreas() {
        return studyAreas.findAll().stream().map(StudyAreaDto::from).toList();
    }

    @GetMapping("/api/study-areas/{id}")
    @Transactional(readOnly = true)
    public StudyAreaDto studyArea(@PathVariable Long id) {
        return StudyAreaDto.from(studyAreas.findById(id).orElseThrow(() -> ApiException.notFound("Study area")));
    }

    @GetMapping("/api/datasets")
    public List<DatasetDto> datasets(@RequestParam(required = false) String type) {
        return datasets.list(type);
    }

    @PostMapping(value = "/api/datasets/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','ANALYST')")
    @Operation(summary = "Upload a GeoTIFF / CSV / GeoJSON dataset (validated and inspected by the AI service)")
    public DatasetDto upload(@RequestPart("file") MultipartFile file,
                             @RequestParam String dataType,
                             @RequestParam(required = false) String name,
                             @RequestParam(required = false) String source,
                             @RequestParam(required = false) String collectionDate,
                             @RequestParam(required = false) String coverage,
                             @RequestParam(defaultValue = "true") boolean realData,
                             @RequestParam(required = false) String landsatParams,
                             @RequestParam(required = false) String lulcMapping) {
        return datasets.upload(file, dataType, name, source, collectionDate, coverage, realData, landsatParams, lulcMapping, auth.currentUser());
    }

    @DeleteMapping("/api/datasets/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','ANALYST')")
    public ResponseEntity<Void> deleteDataset(@PathVariable Long id) {
        datasets.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/datasets/sync")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Integer> sync() {
        return Map.of("added", datasets.syncFromAiService());
    }

    @PostMapping("/api/analysis/runs")
    @PreAuthorize("hasAnyRole('ADMIN','ANALYST')")
    @Operation(summary = "Start the complete analysis pipeline (asynchronous; poll GET /api/analysis/runs/{id})")
    public RunResponse start(@Valid @RequestBody StartAnalysisRequest req) {
        return analysis.start(req, auth.currentUser());
    }

    @GetMapping("/api/analysis/runs")
    public List<RunResponse> runs() {
        return analysis.list();
    }

    @GetMapping("/api/analysis/runs/active")
    public ResponseEntity<RunResponse> active() {
        return analysis.active().map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/api/analysis/runs/{id}")
    public RunResponse run(@PathVariable Long id) {
        return analysis.get(id);
    }

    @DeleteMapping("/api/analysis/runs/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteRun(@PathVariable Long id) {
        analysis.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/analysis/reset-demo")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Delete all analysis results and re-run the Nagpur demonstration analysis")
    public RunResponse resetDemo() {
        return analysis.resetDemo(auth.currentUser());
    }
}
