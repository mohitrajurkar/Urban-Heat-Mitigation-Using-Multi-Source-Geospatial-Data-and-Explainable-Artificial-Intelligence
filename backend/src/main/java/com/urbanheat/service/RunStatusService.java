package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.urbanheat.entity.AnalysisRun;
import com.urbanheat.entity.RunStatus;
import com.urbanheat.exception.ApiException;
import com.urbanheat.repository.AnalysisRunRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.function.Consumer;

/** Short independent transactions so run progress is visible to pollers while the pipeline executes. */
@Service
@RequiredArgsConstructor
public class RunStatusService {
    private final AnalysisRunRepository runs;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void step(Long runId, String step, int progress) {
        update(runId, r -> {
            r.setStatus(RunStatus.RUNNING);
            r.setCurrentStep(step);
            r.setProgress(progress);
            r.setMessage(step + "...");
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void update(Long runId, Consumer<AnalysisRun> fn) {
        AnalysisRun r = runs.findById(runId).orElseThrow(() -> ApiException.notFound("Analysis run " + runId));
        fn.accept(r);
        runs.save(r);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(Long runId) {
        update(runId, r -> {
            r.setStatus(RunStatus.COMPLETED);
            r.setProgress(100);
            r.setCurrentStep("Completed");
            r.setMessage("Analysis completed successfully");
            r.setCompletedAt(OffsetDateTime.now());
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(Long runId, String message) {
        update(runId, r -> {
            r.setStatus(RunStatus.FAILED);
            r.setMessage(message);
            r.setCompletedAt(OffsetDateTime.now());
        });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void setJson(Long runId, String field, JsonNode value) {
        update(runId, r -> {
            switch (field) {
                case "preprocessing" -> r.setPreprocessingSummary(value);
                case "features" -> r.setFeatureSummary(value);
                case "evaluation" -> r.setEvaluationSummary(value);
                case "shap" -> r.setShapGlobal(value);
                case "layers" -> r.setLayersMeta(value);
                case "hotspots" -> r.setHotspotSummary(value);
                case "recommendations" -> r.setRecommendationSummary(value);
                default -> throw new IllegalArgumentException(field);
            }
        });
    }
}
