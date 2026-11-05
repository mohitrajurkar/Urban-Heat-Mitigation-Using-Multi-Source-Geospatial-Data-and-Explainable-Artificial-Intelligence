package com.urbanheat.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.urbanheat.entity.AnalysisRun;
import com.urbanheat.entity.RunStatus;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.time.OffsetDateTime;
import java.util.Map;

public final class AnalysisDtos {
    private AnalysisDtos() {
    }

    /** datasets: role -> AI dataset id (landsat required; sentinel2, lulc, meteorological, population, roads optional). Empty = demo data. */
    public record StartAnalysisRequest(
            Long studyAreaId,
            Map<String, String> datasets,
            @Min(20) @Max(1000) Integer nEstimators,
            @Min(2) @Max(30) Integer maxDepth,
            @DecimalMin("0.001") @DecimalMax("1.0") Double learningRate,
            @DecimalMin("0.1") @DecimalMax("0.5") Double testSize) {
    }

    public record RunResponse(Long id, String aiRunId, Long studyAreaId, String studyAreaName, RunStatus status, String currentStep,
                              int progress, String message, boolean demo, JsonNode parameters, JsonNode datasetSelection,
                              OffsetDateTime startedAt, OffsetDateTime completedAt, Long durationSeconds) {
        public static RunResponse from(AnalysisRun r) {
            Long dur = r.getCompletedAt() == null ? null : java.time.Duration.between(r.getStartedAt(), r.getCompletedAt()).getSeconds();
            return new RunResponse(r.getId(), r.getAiRunId(), r.getStudyArea().getId(), r.getStudyArea().getName(), r.getStatus(),
                    r.getCurrentStep(), r.getProgress(), r.getMessage(), r.isDemo(), r.getParameters(), r.getDatasetSelection(),
                    r.getStartedAt(), r.getCompletedAt(), dur);
        }
    }
}
