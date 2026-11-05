package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.urbanheat.dto.AnalysisDtos.RunResponse;
import com.urbanheat.dto.AnalysisDtos.StartAnalysisRequest;
import com.urbanheat.entity.AnalysisRun;
import com.urbanheat.entity.RunStatus;
import com.urbanheat.entity.StudyArea;
import com.urbanheat.entity.User;
import com.urbanheat.exception.ApiException;
import com.urbanheat.repository.AnalysisRunRepository;
import com.urbanheat.repository.StudyAreaRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.*;
import java.util.concurrent.Executor;

/**
 * Orchestrates the complete workflow against the AI service:
 * preprocess -> features -> train -> predict -> SHAP -> hotspots -> recommendations,
 * persisting every step in PostgreSQL/PostGIS. Runs asynchronously with progress reporting.
 */
@Slf4j
@Service
public class AnalysisService {
    private static final List<String> DATASET_KEYS = List.of("landsat", "sentinel2", "lulc", "meteorological", "population", "roads");
    private final AnalysisRunRepository runs;
    private final StudyAreaRepository studyAreas;
    private final AiServiceClient ai;
    private final ResultPersistenceService persistence;
    private final RunStatusService status;
    private final SettingsService settings;
    private final ObjectMapper mapper;
    private final Executor executor;

    public AnalysisService(AnalysisRunRepository runs, StudyAreaRepository studyAreas, AiServiceClient ai, ResultPersistenceService persistence,
                           RunStatusService status, SettingsService settings, ObjectMapper mapper, @Qualifier("analysisExecutor") Executor executor) {
        this.runs = runs;
        this.studyAreas = studyAreas;
        this.ai = ai;
        this.persistence = persistence;
        this.status = status;
        this.settings = settings;
        this.mapper = mapper;
        this.executor = executor;
    }

    public static Map<String, String> demoSelection() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("landsat", "demo-landsat9");
        m.put("sentinel2", "demo-sentinel2");
        m.put("lulc", "demo-lulc");
        m.put("meteorological", "demo-meteo");
        m.put("population", "demo-population");
        m.put("roads", "demo-roads");
        return m;
    }

    @Transactional
    public RunResponse start(StartAnalysisRequest req, User user) {
        if (runs.existsByStatusIn(List.of(RunStatus.PENDING, RunStatus.RUNNING))) {
            throw ApiException.conflict("Another analysis is already running. Please wait for it to finish.");
        }
        StudyArea sa = req.studyAreaId() != null
                ? studyAreas.findById(req.studyAreaId()).orElseThrow(() -> ApiException.notFound("Study area"))
                : studyAreas.findByCode("nagpur").orElseThrow(() -> ApiException.notFound("Study area 'nagpur'"));
        Map<String, String> selection = new LinkedHashMap<>();
        if (req.datasets() == null || req.datasets().isEmpty()) {
            selection.putAll(demoSelection());
        } else {
            req.datasets().forEach((k, v) -> {
                if (!DATASET_KEYS.contains(k)) {
                    throw ApiException.badRequest("Unknown dataset role '" + k + "'. Allowed: " + DATASET_KEYS);
                }
                if (v != null && !v.isBlank()) {
                    selection.put(k, v);
                }
            });
        }
        if (!selection.containsKey("landsat")) {
            throw ApiException.badRequest("A Landsat 8/9 dataset is required (thermal band for LST)");
        }
        AnalysisRun run = new AnalysisRun();
        run.setStudyArea(sa);
        run.setStatus(RunStatus.PENDING);
        run.setCurrentStep("Queued");
        run.setMessage("Waiting to start");
        run.setDemo(selection.values().stream().allMatch(v -> v.startsWith("demo-")));
        run.setCreatedBy(user);
        run.setDatasetSelection(mapper.valueToTree(selection));
        ObjectNode params = mapper.createObjectNode();
        params.put("n_estimators", req.nEstimators() != null ? req.nEstimators() : 200);
        if (req.maxDepth() != null) {
            params.put("max_depth", req.maxDepth());
        }
        params.put("learning_rate", req.learningRate() != null ? req.learningRate() : 0.06);
        params.put("test_size", req.testSize() != null ? req.testSize() : 0.25);
        run.setParameters(params);
        runs.save(run);
        Long runId = run.getId();
        String code = sa.getCode();
        Long saId = sa.getId();
        // start only after the run row is committed, otherwise the worker thread cannot see it
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                executor.execute(() -> execute(runId, saId, code, selection, params));
            }
        });
        return RunResponse.from(run);
    }

    void execute(Long runId, Long studyAreaId, String studyAreaCode, Map<String, String> selection, JsonNode params) {
        long t0 = System.currentTimeMillis();
        try {
            status.step(runId, "Preprocessing datasets (CRS conversion, resampling, cleaning)", 5);
            Map<String, Object> body = new HashMap<>();
            body.put("study_area", studyAreaCode);
            body.put("datasets", selection);
            JsonNode pre = ai.preprocess(body);
            String aiRunId = pre.get("run_id").asText();
            status.update(runId, r -> {
                r.setAiRunId(aiRunId);
                r.setPreprocessingSummary(pre.get("report"));
            });

            status.step(runId, "Extracting LST, NDVI, NDBI, NDWI, albedo and LULC", 15);
            JsonNode feats = ai.extractFeatures(aiRunId);
            Map<Integer, Long> regionIds = persistence.saveRegions(runId, studyAreaId, feats.get("regions"));
            status.setJson(runId, "features", feats.get("summary"));
            status.setJson(runId, "layers", feats.get("layers"));

            status.step(runId, "Training Random Forest and XGBoost models", 30);
            JsonNode eval = ai.train(aiRunId, mapper.convertValue(params, Map.class));
            persistence.saveEvaluations(runId, eval);
            ObjectNode evalSummary = eval.deepCopy();
            evalSummary.remove("models");
            evalSummary.set("metrics", compactMetrics(eval.get("models")));
            status.setJson(runId, "evaluation", evalSummary);

            status.step(runId, "Predicting heat severity and LST for all regions", 55);
            JsonNode preds = ai.predict(aiRunId);
            persistence.savePredictions(runId, preds.get("predictions"), regionIds);

            status.step(runId, "Computing SHAP explanations", 65);
            JsonNode shap = ai.explain(aiRunId);
            persistence.saveShap(runId, shap, regionIds);
            ObjectNode shapGlobal = mapper.createObjectNode();
            shapGlobal.set("global", shap.get("global"));
            shapGlobal.set("best_model", shap.get("best_model"));
            status.setJson(runId, "shap", shapGlobal);

            status.step(runId, "Detecting hotspots (thresholds + Getis-Ord Gi*)", 80);
            JsonNode hs = ai.detectHotspots(aiRunId);
            Map<Integer, Long> hotspotIds = persistence.saveHotspots(runId, hs.get("all_regions"), regionIds);
            status.setJson(runId, "hotspots", hs.get("summary"));

            status.step(runId, "Generating mitigation strategies, costs and priorities", 90);
            Map<String, Object> overrides = Map.of("priority_weights", settings.getPriorityWeights());
            JsonNode rec = ai.generateRecommendations(aiRunId, overrides);
            persistence.saveRecommendations(runId, rec, regionIds, hotspotIds);
            ObjectNode recSummary = rec.get("summary").deepCopy();
            recSummary.set("assumptions", rec.get("assumptions"));
            status.setJson(runId, "recommendations", recSummary);

            status.complete(runId);
            log.info("Analysis run {} ({}) completed in {} s", runId, aiRunId, (System.currentTimeMillis() - t0) / 1000);
        } catch (Exception e) {
            log.error("Analysis run {} failed", runId, e);
            status.fail(runId, e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        }
    }

    private JsonNode compactMetrics(JsonNode models) {
        ObjectNode out = mapper.createObjectNode();
        models.fields().forEachRemaining(m -> {
            ObjectNode mm = out.putObject(m.getKey());
            m.getValue().fields().forEachRemaining(t -> {
                ObjectNode copy = t.getValue().deepCopy();
                copy.remove(List.of("scatter", "per_class"));
                mm.set(t.getKey(), copy);
            });
        });
        return out;
    }

    @Transactional(readOnly = true)
    public List<RunResponse> list() {
        return runs.findAllByOrderByStartedAtDesc().stream().map(RunResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public RunResponse get(Long id) {
        return RunResponse.from(runs.findById(id).orElseThrow(() -> ApiException.notFound("Analysis run " + id)));
    }

    @Transactional(readOnly = true)
    public AnalysisRun resolveRun(Long runId) {
        if (runId != null) {
            AnalysisRun r = runs.findById(runId).orElseThrow(() -> ApiException.notFound("Analysis run " + runId));
            if (r.getStatus() != RunStatus.COMPLETED) {
                throw ApiException.conflict("Analysis run " + runId + " is " + r.getStatus());
            }
            return r;
        }
        return runs.findFirstByStatusOrderByCompletedAtDesc(RunStatus.COMPLETED)
                .orElseThrow(() -> new ApiException(org.springframework.http.HttpStatus.NOT_FOUND,
                        "No completed analysis yet. The demo analysis starts automatically on first launch - check Dataset Management for progress."));
    }

    @Transactional(readOnly = true)
    public Optional<RunResponse> active() {
        return runs.findAllByOrderByStartedAtDesc().stream()
                .filter(r -> r.getStatus() == RunStatus.PENDING || r.getStatus() == RunStatus.RUNNING)
                .findFirst().map(RunResponse::from);
    }

    @Transactional
    public void delete(Long id) {
        AnalysisRun r = runs.findById(id).orElseThrow(() -> ApiException.notFound("Analysis run " + id));
        if (r.getStatus() == RunStatus.RUNNING || r.getStatus() == RunStatus.PENDING) {
            throw ApiException.conflict("A running analysis cannot be deleted");
        }
        runs.delete(r);
    }

    /** Deletes every analysis run (cascade removes all results) and starts a fresh demo analysis. */
    @Transactional
    public RunResponse resetDemo(User user) {
        if (runs.existsByStatusIn(List.of(RunStatus.PENDING, RunStatus.RUNNING))) {
            throw ApiException.conflict("Wait for the running analysis to finish before resetting");
        }
        runs.deleteAll(runs.findAll());
        runs.flush();
        return start(new StartAnalysisRequest(null, null, null, null, null, null), user);
    }
}
