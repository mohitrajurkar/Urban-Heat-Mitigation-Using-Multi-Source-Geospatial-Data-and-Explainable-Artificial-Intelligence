package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.urbanheat.entity.*;
import com.urbanheat.util.GeoUtil;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

import static com.urbanheat.util.Json.*;

/** Persists the output of each AI pipeline step into PostgreSQL/PostGIS (batched inserts). */
@Slf4j
@Service
@RequiredArgsConstructor
public class ResultPersistenceService {
    private static final int FLUSH_EVERY = 500;
    private final EntityManager em;
    private final ObjectMapper mapper;

    private void maybeFlush(int i) {
        if (i > 0 && i % FLUSH_EVERY == 0) {
            em.flush();
            em.clear();
        }
    }

    private AnalysisRun runRef(Long runId) {
        return em.getReference(AnalysisRun.class, runId);
    }

    @Transactional
    public Map<Integer, Long> saveRegions(Long runId, Long studyAreaId, JsonNode regions) {
        Map<Integer, GeographicRegion> created = new HashMap<>();
        AnalysisRun run = runRef(runId);
        StudyArea sa = em.getReference(StudyArea.class, studyAreaId);
        int i = 0;
        for (JsonNode r : regions) {
            GeographicRegion g = new GeographicRegion();
            g.setRun(run);
            g.setStudyArea(sa);
            g.setCellIndex(r.get("cell_index").asInt());
            g.setRegionCode(str(r, "region_code"));
            g.setName(str(r, "name"));
            g.setLocality(str(r, "locality"));
            g.setRowIdx(r.get("row").asInt());
            g.setColIdx(r.get("col").asInt());
            g.setAreaKm2(dbl(r, "area_km2"));
            g.setGeom(GeoUtil.polygon(r.get("geometry")));
            g.setCentroid(GeoUtil.point(r.get("centroid")));
            em.persist(g);

            EnvironmentalIndicator ind = new EnvironmentalIndicator();
            ind.setRegion(g);
            ind.setRun(run);
            ind.setLstMean(dbl(r, "lst_mean"));
            ind.setLstMin(dbl(r, "lst_min"));
            ind.setLstMax(dbl(r, "lst_max"));
            ind.setLstStd(dbl(r, "lst_std"));
            ind.setNdviMean(dbl(r, "ndvi_mean"));
            ind.setNdbiMean(dbl(r, "ndbi_mean"));
            ind.setNdwiMean(dbl(r, "ndwi_mean"));
            ind.setAlbedoMean(dbl(r, "albedo_mean"));
            ind.setLulcMajority(integer(r, "lulc_majority"));
            ind.setLulcMajorityName(str(r, "lulc_majority_name"));
            ind.setLulcFractions(r.get("lulc_fractions"));
            ind.setBuiltFraction(dbl(r, "built_fraction"));
            ind.setVegetationFraction(dbl(r, "vegetation_fraction"));
            ind.setWaterFraction(dbl(r, "water_fraction"));
            ind.setOpenLandFraction(dbl(r, "open_land_fraction"));
            ind.setAirTempMax(dbl(r, "air_temp_max"));
            ind.setRelativeHumidity(dbl(r, "relative_humidity"));
            ind.setWindSpeed(dbl(r, "wind_speed"));
            ind.setPopulation(dbl(r, "population"));
            ind.setPopulationDensity(dbl(r, "population_density"));
            ind.setRoadDensity(dbl(r, "road_density"));
            ind.setValidPixelPct(dbl(r, "valid_pixel_pct"));
            ind.setLabelQualityOk(bool(r, "label_quality_ok"));
            em.persist(ind);
            created.put(g.getCellIndex(), g);
            maybeFlush(++i);
        }
        em.flush();
        Map<Integer, Long> ids = new HashMap<>();
        created.forEach((k, v) -> ids.put(k, v.getId()));
        log.info("Stored {} regions + indicators for run {}", ids.size(), runId);
        return ids;
    }

    @Transactional
    public void saveEvaluations(Long runId, JsonNode eval) {
        AnalysisRun run = runRef(runId);
        JsonNode best = eval.get("best_model");
        eval.get("models").fields().forEachRemaining(model -> model.getValue().fields().forEachRemaining(taskEntry -> {
            JsonNode m = taskEntry.getValue();
            String task = taskEntry.getKey();
            ModelEvaluation e = new ModelEvaluation();
            e.setRun(run);
            e.setModelName(model.getKey());
            e.setTask(task);
            e.setAccuracy(dbl(m, "accuracy"));
            e.setPrecisionMacro(dbl(m, "precision"));
            e.setRecallMacro(dbl(m, "recall"));
            e.setF1Macro(dbl(m, "f1"));
            e.setMae(dbl(m, "mae"));
            e.setRmse(dbl(m, "rmse"));
            e.setR2(dbl(m, "r2"));
            e.setCvMean(dbl(m, "cv_mean"));
            e.setCvStd(dbl(m, "cv_std"));
            e.setTrainSamples(integer(eval, "train_samples"));
            e.setTestSamples(integer(eval, "test_samples"));
            e.setTrainingSeconds(dbl(m, "training_seconds"));
            e.setBest(model.getKey().equals(best.path(task).asText()));
            e.setConfusionMatrix(m.get("confusion_matrix"));
            e.setFeatureImportance(m.get("feature_importance"));
            ObjectNode details = ((ObjectNode) m.deepCopy());
            details.remove(java.util.List.of("confusion_matrix", "feature_importance"));
            e.setDetails(details);
            em.persist(e);
        }));
    }

    @Transactional
    public void savePredictions(Long runId, JsonNode predictions, Map<Integer, Long> regionIds) {
        AnalysisRun run = runRef(runId);
        int i = 0;
        for (JsonNode p : predictions) {
            GeographicRegion region = em.getReference(GeographicRegion.class, regionIds.get(p.get("cell_index").asInt()));
            String bestCls = str(p, "best_classifier");
            var fields = p.get("models").fields();
            while (fields.hasNext()) {
                var entry = fields.next();
                JsonNode m = entry.getValue();
                AiPrediction ap = new AiPrediction();
                ap.setRun(run);
                ap.setRegion(region);
                ap.setModelName(entry.getKey());
                ap.setPredictedClass(str(m, "predicted_class"));
                ap.setClassProbabilities(m.get("class_probabilities"));
                ap.setPredictedLst(dbl(m, "predicted_lst"));
                ap.setObservedClass(str(p, "observed_class"));
                ap.setObservedLst(dbl(p, "observed_lst"));
                ap.setBestModel(entry.getKey().equals(bestCls));
                em.persist(ap);
                maybeFlush(++i);
            }
        }
        em.flush();
    }

    @Transactional
    public void saveShap(Long runId, JsonNode shap, Map<Integer, Long> regionIds) {
        AnalysisRun run = runRef(runId);
        shap.get("global").fields().forEachRemaining(model -> model.getValue().fields().forEachRemaining(task -> {
            ShapExplanation g = new ShapExplanation();
            g.setRun(run);
            g.setModelName(model.getKey());
            g.setExplanationType("GLOBAL");
            g.setTask(task.getKey());
            JsonNode base = task.getValue().get("base_value");
            g.setBaseValue(base != null && base.isNumber() ? base.asDouble() : null);
            g.setContributions(task.getValue().get("importance"));
            em.persist(g);
        }));
        int i = 0;
        for (JsonNode l : shap.get("local")) {
            ShapExplanation e = new ShapExplanation();
            e.setRun(run);
            e.setRegion(em.getReference(GeographicRegion.class, regionIds.get(l.get("cell_index").asInt())));
            e.setModelName(str(l, "model"));
            e.setExplanationType("LOCAL");
            e.setTask("regression");
            e.setBaseValue(dbl(l, "base_value"));
            e.setPredictedValue(dbl(l, "predicted_value"));
            e.setPredictedClass(str(l, "predicted_class"));
            e.setContributions(l.get("contributions"));
            e.setClassContributions(l.get("class_contributions"));
            e.setExplanationText(str(l, "explanation"));
            em.persist(e);
            maybeFlush(++i);
        }
        em.flush();
    }

    @Transactional
    public Map<Integer, Long> saveHotspots(Long runId, JsonNode regions, Map<Integer, Long> regionIds) {
        AnalysisRun run = runRef(runId);
        Map<Integer, Hotspot> created = new HashMap<>();
        int i = 0;
        for (JsonNode h : regions) {
            Hotspot hs = new Hotspot();
            hs.setRun(run);
            hs.setRegion(em.getReference(GeographicRegion.class, regionIds.get(h.get("cell_index").asInt())));
            hs.setSeverity(str(h, "severity"));
            hs.setSeveritySource(str(h, "severity_source"));
            hs.setObservedSeverity(str(h, "observed_severity"));
            hs.setPredictedSeverity(str(h, "predicted_severity"));
            hs.setHotspot(bool(h, "is_hotspot"));
            hs.setLst(dbl(h, "lst"));
            hs.setLstAnomaly(dbl(h, "lst_anomaly"));
            hs.setGiStarZ(dbl(h, "gi_star_z"));
            hs.setGiStarSignificant(bool(h, "gi_star_significant"));
            hs.setLocation(GeoUtil.point(h.get("centroid")));
            em.persist(hs);
            created.put(h.get("cell_index").asInt(), hs);
            maybeFlush(++i);
        }
        em.flush();
        Map<Integer, Long> ids = new HashMap<>();
        created.forEach((k, v) -> ids.put(k, v.getId()));
        return ids;
    }

    @Transactional
    public void saveRecommendations(Long runId, JsonNode payload, Map<Integer, Long> regionIds, Map<Integer, Long> hotspotIds) {
        AnalysisRun run = runRef(runId);
        int i = 0;
        for (JsonNode r : payload.get("recommendations")) {
            int cell = r.get("cell_index").asInt();
            MitigationRecommendation m = new MitigationRecommendation();
            m.setRun(run);
            m.setHotspot(em.getReference(Hotspot.class, hotspotIds.get(cell)));
            m.setRegion(em.getReference(GeographicRegion.class, regionIds.get(cell)));
            m.setInterventionType(str(r, "type"));
            m.setInterventionName(str(r, "name"));
            m.setDescription(str(r, "description"));
            m.setReason(str(r, "reason"));
            m.setLocation(GeoUtil.point(r.get("location")));
            m.setLocationDescription(str(r, "location_description"));
            m.setAreaM2(dbl(r, "area_m2"));
            m.setQuantity(dbl(r, "quantity"));
            m.setUnit(str(r, "unit"));
            m.setCoolingC(dbl(r, "cooling_c"));
            m.setSuitability(dbl(r, "suitability"));
            m.setPriorityLevel(str(r, "priority_level"));
            m.setCostEffectivenessRank(integer(r, "cost_effectiveness_rank"));
            em.persist(m);

            CostEstimate c = new CostEstimate();
            c.setRecommendation(m);
            c.setRun(run);
            c.setUnitCost(dbl(r, "unit_cost_inr"));
            c.setUnitCostBasis(str(r, "unit_cost_basis"));
            c.setEstimatedCost(dbl(r, "cost_inr"));
            c.setCostLow(dbl(r, "cost_low_inr"));
            c.setCostHigh(dbl(r, "cost_high_inr"));
            c.setCostPerDegree(dbl(r, "cost_per_degree_inr"));
            em.persist(c);
            maybeFlush(++i);
        }
        for (JsonNode p : payload.get("rankings")) {
            int cell = p.get("cell_index").asInt();
            JsonNode comp = p.get("components");
            PriorityRanking pr = new PriorityRanking();
            pr.setRun(run);
            pr.setHotspot(em.getReference(Hotspot.class, hotspotIds.get(cell)));
            pr.setRegion(em.getReference(GeographicRegion.class, regionIds.get(cell)));
            pr.setRank(p.get("rank").asInt());
            pr.setScore(dbl(p, "score"));
            pr.setPriorityLevel(str(p, "priority_level"));
            pr.setHeatScore(dbl(comp, "heat_severity"));
            pr.setVulnerabilityScore(dbl(comp, "population_vulnerability"));
            pr.setVegetationDeficitScore(dbl(comp, "vegetation_deficit"));
            pr.setFeasibilityScore(dbl(comp, "implementation_feasibility"));
            pr.setCoolingBenefitScore(dbl(comp, "cooling_benefit"));
            pr.setExpectedCoolingC(dbl(p, "expected_cooling_c"));
            pr.setEstimatedCost(dbl(p, "estimated_cost_inr"));
            pr.setNInterventions(integer(p, "n_interventions"));
            pr.setWeights(p.get("weights"));
            em.persist(pr);
            maybeFlush(++i);
        }
        em.flush();
    }
}
