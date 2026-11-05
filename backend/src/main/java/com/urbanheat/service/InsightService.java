package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.urbanheat.dto.AnalysisDtos.RunResponse;
import com.urbanheat.dto.PageResponse;
import com.urbanheat.dto.ViewDtos.*;
import com.urbanheat.entity.*;
import com.urbanheat.exception.ApiException;
import com.urbanheat.repository.*;
import com.urbanheat.util.GeoUtil;
import com.urbanheat.util.Maps;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.function.ToDoubleFunction;
import java.util.stream.Collectors;

/** Read-side queries for indicators, GIS layers, hotspots, predictions and SHAP explanations. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InsightService {
    private final AnalysisService analysis;
    private final EnvironmentalIndicatorRepository indicators;
    private final HotspotRepository hotspots;
    private final PriorityRankingRepository rankings;
    private final AiPredictionRepository predictions;
    private final ModelEvaluationRepository evaluations;
    private final ShapExplanationRepository shap;
    private final MitigationRecommendationRepository recommendations;
    private final CostEstimateRepository costs;
    private final GeographicRegionRepository regions;
    private final AiServiceClient ai;
    private final ObjectMapper mapper;

    // ------------------------------------------------------------------ indicators
    public Map<String, Object> indicatorSummary(Long runId) {
        AnalysisRun run = analysis.resolveRun(runId);
        List<EnvironmentalIndicator> rows = indicators.findByRunWithRegion(run.getId());
        Map<String, ToDoubleFunction<EnvironmentalIndicator>> fields = new LinkedHashMap<>();
        fields.put("lst", i -> nz(i.getLstMean()));
        fields.put("ndvi", i -> nz(i.getNdviMean()));
        fields.put("ndbi", i -> nz(i.getNdbiMean()));
        fields.put("ndwi", i -> nz(i.getNdwiMean()));
        fields.put("albedo", i -> nz(i.getAlbedoMean()));
        Map<String, Object> hist = new LinkedHashMap<>();
        Map<String, Object> corr = new LinkedHashMap<>();
        List<EnvironmentalIndicator> labelled = rows.stream().filter(i -> i.getLstMean() != null).toList();
        fields.forEach((k, f) -> {
            double[] v = rows.stream().mapToDouble(f).filter(Double::isFinite).toArray();
            hist.put(k, histogram(v, 16));
            if (!k.equals("lst")) {
                corr.put(k, pearson(labelled.stream().mapToDouble(f).toArray(), labelled.stream().mapToDouble(i -> i.getLstMean()).toArray()));
            }
        });
        corr.put("built_fraction", pearson(labelled.stream().mapToDouble(i -> nz(i.getBuiltFraction())).toArray(), labelled.stream().mapToDouble(i -> i.getLstMean()).toArray()));
        corr.put("vegetation_fraction", pearson(labelled.stream().mapToDouble(i -> nz(i.getVegetationFraction())).toArray(), labelled.stream().mapToDouble(i -> i.getLstMean()).toArray()));
        Map<String, List<EnvironmentalIndicator>> byLulc = rows.stream().filter(i -> i.getLulcMajorityName() != null)
                .collect(Collectors.groupingBy(EnvironmentalIndicator::getLulcMajorityName, TreeMap::new, Collectors.toList()));
        List<Map<String, Object>> lulc = new ArrayList<>();
        byLulc.forEach((name, list) -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("lulc", name);
            m.put("regions", list.size());
            m.put("meanLst", avg(list, EnvironmentalIndicator::getLstMean));
            m.put("meanNdvi", avg(list, EnvironmentalIndicator::getNdviMean));
            m.put("meanNdbi", avg(list, EnvironmentalIndicator::getNdbiMean));
            m.put("meanAlbedo", avg(list, EnvironmentalIndicator::getAlbedoMean));
            lulc.add(m);
        });
        List<Map<String, Object>> scatter = new ArrayList<>();
        int step = Math.max(1, labelled.size() / 400);
        for (int i = 0; i < labelled.size(); i += step) {
            EnvironmentalIndicator e = labelled.get(i);
            scatter.add(Maps.of("lst", e.getLstMean(), "ndvi", nz(e.getNdviMean()), "ndbi", nz(e.getNdbiMean()),
                    "albedo", nz(e.getAlbedoMean()), "lulc", Objects.toString(e.getLulcMajorityName(), "")));
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("run", RunResponse.from(run));
        out.put("summary", run.getFeatureSummary());
        out.put("preprocessing", run.getPreprocessingSummary());
        out.put("layers", run.getLayersMeta());
        out.put("histograms", hist);
        out.put("correlationWithLst", corr);
        out.put("byLulc", lulc);
        out.put("scatter", scatter);
        return out;
    }

    public PageResponse<IndicatorRow> indicatorRows(Long runId, String search, String lulc, String sort, int page, int size) {
        AnalysisRun run = analysis.resolveRun(runId);
        String q = norm(search);
        List<IndicatorRow> list = indicators.findByRunWithRegion(run.getId()).stream()
                .filter(i -> q.isEmpty() || i.getRegion().getName().toLowerCase().contains(q) || i.getRegion().getRegionCode().toLowerCase().contains(q))
                .filter(i -> lulc == null || lulc.isBlank() || lulc.equals(i.getLulcMajorityName()))
                .map(IndicatorRow::from)
                .sorted(indicatorComparator(sort))
                .toList();
        return PageResponse.of(list, page, size);
    }

    private Comparator<IndicatorRow> indicatorComparator(String sort) {
        String s = sort == null ? "lst,desc" : sort;
        boolean asc = s.endsWith(",asc");
        Comparator<IndicatorRow> c = switch (s.split(",")[0]) {
            case "ndvi" -> Comparator.comparing(IndicatorRow::ndvi, Comparator.nullsLast(Comparator.naturalOrder()));
            case "ndbi" -> Comparator.comparing(IndicatorRow::ndbi, Comparator.nullsLast(Comparator.naturalOrder()));
            case "albedo" -> Comparator.comparing(IndicatorRow::albedo, Comparator.nullsLast(Comparator.naturalOrder()));
            case "name" -> Comparator.comparing(IndicatorRow::name);
            case "population" -> Comparator.comparing(IndicatorRow::populationDensity, Comparator.nullsLast(Comparator.naturalOrder()));
            default -> Comparator.comparing(IndicatorRow::lstMean, Comparator.nullsLast(Comparator.naturalOrder()));
        };
        return asc ? c : c.reversed();
    }

    // ------------------------------------------------------------------ map
    public ObjectNode regionsGeoJson(Long runId) {
        AnalysisRun run = analysis.resolveRun(runId);
        Map<Long, Hotspot> hs = hotspots.findByRunWithRegion(run.getId()).stream().collect(Collectors.toMap(h -> h.getRegion().getId(), Function.identity()));
        Map<Long, PriorityRanking> pr = rankings.findByRunWithRegion(run.getId()).stream().collect(Collectors.toMap(p -> p.getRegion().getId(), Function.identity()));
        Map<Long, AiPrediction> best = predictions.findByRunWithRegion(run.getId()).stream().filter(AiPrediction::isBestModel)
                .collect(Collectors.toMap(p -> p.getRegion().getId(), Function.identity(), (a, b) -> a));
        ObjectNode fc = mapper.createObjectNode();
        fc.put("type", "FeatureCollection");
        ArrayNode features = fc.putArray("features");
        for (EnvironmentalIndicator i : indicators.findByRunWithRegion(run.getId())) {
            GeographicRegion r = i.getRegion();
            ObjectNode f = features.addObject();
            f.put("type", "Feature");
            f.put("id", r.getId());
            f.set("geometry", GeoUtil.toGeoJson(r.getGeom(), mapper));
            ObjectNode p = f.putObject("properties");
            p.put("regionId", r.getId());
            p.put("code", r.getRegionCode());
            p.put("name", r.getName());
            p.put("locality", r.getLocality());
            putNum(p, "lst", i.getLstMean());
            putNum(p, "ndvi", i.getNdviMean());
            putNum(p, "ndbi", i.getNdbiMean());
            putNum(p, "ndwi", i.getNdwiMean());
            putNum(p, "albedo", i.getAlbedoMean());
            p.put("lulc", i.getLulcMajority());
            p.put("lulcName", i.getLulcMajorityName());
            putNum(p, "builtFraction", i.getBuiltFraction());
            putNum(p, "vegetationFraction", i.getVegetationFraction());
            putNum(p, "populationDensity", i.getPopulationDensity());
            Hotspot h = hs.get(r.getId());
            if (h != null) {
                p.put("hotspotId", h.getId());
                p.put("severity", h.getSeverity());
                p.put("isHotspot", h.isHotspot());
                putNum(p, "giStarZ", h.getGiStarZ());
                p.put("giStarSignificant", h.isGiStarSignificant());
            }
            AiPrediction b = best.get(r.getId());
            if (b != null) {
                putNum(p, "predictedLst", b.getPredictedLst());
                p.put("predictedClass", b.getPredictedClass());
            }
            PriorityRanking rk = pr.get(r.getId());
            if (rk != null) {
                p.put("rank", rk.getRank());
                putNum(p, "priorityScore", rk.getScore());
                p.put("priorityLevel", rk.getPriorityLevel());
            }
        }
        return fc;
    }

    public JsonNode layers(Long runId) {
        AnalysisRun run = analysis.resolveRun(runId);
        ObjectNode out = mapper.createObjectNode();
        out.put("runId", run.getId());
        out.set("layers", run.getLayersMeta());
        return out;
    }

    public byte[] layerPng(Long runId, String layer) {
        if (!Set.of("lst", "ndvi", "ndbi", "ndwi", "albedo", "lulc").contains(layer)) {
            throw ApiException.badRequest("Unknown layer " + layer);
        }
        return ai.layerPng(analysis.resolveRun(runId).getAiRunId(), layer);
    }

    public List<Map<String, Object>> interventionMarkers(Long runId) {
        AnalysisRun run = analysis.resolveRun(runId);
        Map<Long, CostEstimate> c = costs.findByRunWithRecommendation(run.getId()).stream().collect(Collectors.toMap(x -> x.getRecommendation().getId(), Function.identity()));
        List<Map<String, Object>> out = new ArrayList<>();
        for (MitigationRecommendation m : recommendations.findByRunWithRegion(run.getId())) {
            Map<String, Object> x = new LinkedHashMap<>();
            x.put("id", m.getId());
            x.put("type", m.getInterventionType());
            x.put("name", m.getInterventionName());
            x.put("lon", m.getLocation().getX());
            x.put("lat", m.getLocation().getY());
            x.put("regionId", m.getRegion().getId());
            x.put("regionName", m.getRegion().getName());
            x.put("coolingC", m.getCoolingC());
            x.put("areaM2", m.getAreaM2());
            x.put("priorityLevel", m.getPriorityLevel());
            CostEstimate ce = c.get(m.getId());
            x.put("costInr", ce == null ? null : ce.getEstimatedCost());
            out.add(x);
        }
        return out;
    }

    // ------------------------------------------------------------------ hotspots
    public PageResponse<HotspotRow> hotspotRows(Long runId, String severity, String search, boolean significantOnly, boolean includeAll,
                                                String level, String sort, int page, int size) {
        AnalysisRun run = analysis.resolveRun(runId);
        Map<Long, EnvironmentalIndicator> ind = indicators.findByRunWithRegion(run.getId()).stream().collect(Collectors.toMap(i -> i.getRegion().getId(), Function.identity()));
        Map<Long, PriorityRanking> pr = rankings.findByRunWithRegion(run.getId()).stream().collect(Collectors.toMap(p -> p.getHotspot().getId(), Function.identity()));
        String q = norm(search);
        List<HotspotRow> list = hotspots.findByRunWithRegion(run.getId()).stream()
                .filter(h -> includeAll || h.isHotspot())
                .filter(h -> severity == null || severity.isBlank() || severity.equalsIgnoreCase(h.getSeverity()))
                .filter(h -> !significantOnly || h.isGiStarSignificant())
                .filter(h -> q.isEmpty() || h.getRegion().getName().toLowerCase().contains(q) || h.getRegion().getRegionCode().toLowerCase().contains(q))
                .filter(h -> level == null || level.isBlank() || (pr.get(h.getId()) != null && level.equalsIgnoreCase(pr.get(h.getId()).getPriorityLevel())))
                .map(h -> HotspotRow.from(h, ind.get(h.getRegion().getId()), pr.get(h.getId())))
                .sorted(hotspotComparator(sort))
                .toList();
        return PageResponse.of(list, page, size);
    }

    private Comparator<HotspotRow> hotspotComparator(String sort) {
        String s = sort == null ? "priority,desc" : sort;
        boolean asc = s.endsWith(",asc");
        Comparator<HotspotRow> c = switch (s.split(",")[0]) {
            case "lst" -> Comparator.comparing(HotspotRow::lst, Comparator.nullsFirst(Comparator.naturalOrder()));
            case "gi" -> Comparator.comparing(HotspotRow::giStarZ, Comparator.nullsFirst(Comparator.naturalOrder()));
            case "name" -> Comparator.comparing(HotspotRow::name);
            case "population" -> Comparator.comparing(HotspotRow::populationDensity, Comparator.nullsFirst(Comparator.naturalOrder()));
            default -> Comparator.comparing((HotspotRow r) -> r.priority() == null ? -1.0 : r.priority().score());
        };
        return asc ? c : c.reversed();
    }

    public Map<String, Object> hotspotDetail(Long hotspotId) {
        Hotspot h = hotspots.findByIdWithRegion(hotspotId).orElseThrow(() -> ApiException.notFound("Hotspot " + hotspotId));
        return regionDetail(h.getRegion().getId());
    }

    public Map<String, Object> regionDetail(Long regionId) {
        GeographicRegion r = regions.findById(regionId).orElseThrow(() -> ApiException.notFound("Region " + regionId));
        EnvironmentalIndicator i = indicators.findByRegionId(regionId).orElse(null);
        Hotspot h = hotspots.findByRegionId(regionId).orElse(null);
        PriorityRanking p = rankings.findByRegionId(regionId).orElse(null);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("region", Maps.of("id", r.getId(), "code", r.getRegionCode(), "name", r.getName(), "locality", Objects.toString(r.getLocality(), ""),
                "areaKm2", r.getAreaKm2(), "centroid", GeoUtil.lonLat(r.getCentroid()), "geometry", GeoUtil.toGeoJson(r.getGeom(), mapper)));
        out.put("indicators", i == null ? null : IndicatorRow.from(i));
        out.put("lulcFractions", i == null ? null : i.getLulcFractions());
        out.put("hotspot", h == null ? null : HotspotRow.from(h, i, p));
        out.put("priority", p == null ? null : PriorityDto.from(p));
        out.put("predictions", predictions.findByRegionId(regionId).stream().map(x -> Maps.of("model", x.getModelName(),
                "predictedClass", x.getPredictedClass(), "predictedLst", x.getPredictedLst(), "probabilities", x.getClassProbabilities(),
                "bestModel", x.isBestModel(), "observedClass", x.getObservedClass())).toList());
        out.put("explanation", explanationFor(regionId).orElse(null));
        Map<Long, CostEstimate> c = costs.findByRunWithRecommendation(r.getRun().getId()).stream()
                .filter(x -> x.getRecommendation().getRegion().getId().equals(regionId))
                .collect(Collectors.toMap(x -> x.getRecommendation().getId(), Function.identity()));
        out.put("recommendations", recommendations.findByRegionId(regionId).stream().map(m -> RecommendationRow.from(m, c.get(m.getId()))).toList());
        return out;
    }

    // ------------------------------------------------------------------ predictions
    public Map<String, Object> evaluation(Long runId) {
        AnalysisRun run = analysis.resolveRun(runId);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("runId", run.getId());
        out.put("summary", run.getEvaluationSummary());
        out.put("models", evaluations.findByRunIdOrderByModelNameAscTaskAsc(run.getId()).stream().map(EvaluationDto::from).toList());
        return out;
    }

    public PageResponse<PredictionRow> predictionRows(Long runId, String search, String predictedClass, boolean disagreementsOnly, int page, int size) {
        AnalysisRun run = analysis.resolveRun(runId);
        Map<Long, List<AiPrediction>> byRegion = predictions.findByRunWithRegion(run.getId()).stream()
                .collect(Collectors.groupingBy(p -> p.getRegion().getId(), LinkedHashMap::new, Collectors.toList()));
        String q = norm(search);
        List<PredictionRow> rows = new ArrayList<>();
        byRegion.forEach((rid, list) -> {
            GeographicRegion r = list.get(0).getRegion();
            if (!q.isEmpty() && !r.getName().toLowerCase().contains(q) && !r.getRegionCode().toLowerCase().contains(q)) {
                return;
            }
            Map<String, PredictionModelView> models = new LinkedHashMap<>();
            list.forEach(p -> models.put(p.getModelName(), new PredictionModelView(p.getPredictedClass(), p.getPredictedLst(), p.getClassProbabilities(), p.isBestModel())));
            AiPrediction first = list.get(0);
            boolean anyMatchClass = predictedClass == null || predictedClass.isBlank() || list.stream().anyMatch(p -> p.isBestModel() && predictedClass.equalsIgnoreCase(p.getPredictedClass()));
            boolean disagree = list.stream().anyMatch(p -> first.getObservedClass() != null && !first.getObservedClass().equals(p.getPredictedClass()));
            if (anyMatchClass && (!disagreementsOnly || disagree)) {
                rows.add(new PredictionRow(rid, r.getRegionCode(), r.getName(), r.getLocality(), first.getObservedLst(), first.getObservedClass(), models));
            }
        });
        rows.sort(Comparator.comparing((PredictionRow p) -> p.models().values().stream().filter(PredictionModelView::bestModel)
                .map(PredictionModelView::predictedLst).filter(Objects::nonNull).findFirst().orElse(0.0)).reversed());
        return PageResponse.of(rows, page, size);
    }

    public JsonNode customPrediction(Long runId, JsonNode features) {
        if (features == null || !features.isArray() || features.isEmpty()) {
            throw ApiException.badRequest("features must be a non-empty array of feature objects");
        }
        return ai.explainCustom(analysis.resolveRun(runId).getAiRunId(), features);
    }

    // ------------------------------------------------------------------ explanations
    public JsonNode shapGlobal(Long runId) {
        AnalysisRun run = analysis.resolveRun(runId);
        ObjectNode out = mapper.createObjectNode();
        out.put("runId", run.getId());
        out.set("shap", run.getShapGlobal());
        return out;
    }

    public Optional<LocalExplanationDto> explanationFor(Long regionId) {
        return shap.findFirstByRegionIdAndExplanationType(regionId, "LOCAL").map(e -> {
            GeographicRegion r = e.getRegion();
            Double observed = indicators.findByRegionId(regionId).map(EnvironmentalIndicator::getLstMean).orElse(null);
            return new LocalExplanationDto(r.getId(), r.getRegionCode(), r.getName(), e.getModelName(), e.getBaseValue(), e.getPredictedValue(),
                    e.getPredictedClass(), observed, e.getContributions(), e.getClassContributions(), e.getExplanationText());
        });
    }

    public LocalExplanationDto regionExplanation(Long regionId) {
        return explanationFor(regionId).orElseThrow(() -> ApiException.notFound("SHAP explanation for region " + regionId));
    }

    public byte[] shapPlot(Long runId, String model, String task) {
        if (!Set.of("random_forest", "xgboost").contains(model) || !Set.of("regression", "classification").contains(task)) {
            throw ApiException.badRequest("model must be random_forest|xgboost and task regression|classification");
        }
        return ai.shapPlot(analysis.resolveRun(runId).getAiRunId(), "summary_" + model + "_" + task + ".png");
    }

    // ------------------------------------------------------------------ helpers
    static double nz(Double d) {
        return d == null ? Double.NaN : d;
    }

    static String norm(String s) {
        return s == null ? "" : s.trim().toLowerCase();
    }

    private static Double avg(List<EnvironmentalIndicator> list, Function<EnvironmentalIndicator, Double> f) {
        return list.stream().map(f).filter(Objects::nonNull).mapToDouble(Double::doubleValue).average().stream().boxed().findFirst().orElse(null);
    }

    private static void putNum(ObjectNode n, String k, Double v) {
        if (v == null || !Double.isFinite(v)) {
            n.putNull(k);
        } else {
            n.put(k, Math.round(v * 10000) / 10000.0);
        }
    }

    static List<Map<String, Object>> histogram(double[] v, int bins) {
        List<Map<String, Object>> out = new ArrayList<>();
        if (v.length == 0) {
            return out;
        }
        double min = Arrays.stream(v).min().getAsDouble(), max = Arrays.stream(v).max().getAsDouble();
        double w = (max - min) / bins;
        if (w <= 0) {
            out.add(Maps.of("from", min, "to", max, "count", v.length));
            return out;
        }
        int[] counts = new int[bins];
        for (double x : v) {
            counts[Math.min(bins - 1, (int) ((x - min) / w))]++;
        }
        for (int b = 0; b < bins; b++) {
            out.add(Maps.of("from", min + b * w, "to", min + (b + 1) * w, "count", counts[b]));
        }
        return out;
    }

    static Double pearson(double[] x, double[] y) {
        int n = 0;
        double sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
        for (int i = 0; i < x.length; i++) {
            if (!Double.isFinite(x[i]) || !Double.isFinite(y[i])) {
                continue;
            }
            n++;
            sx += x[i];
            sy += y[i];
            sxx += x[i] * x[i];
            syy += y[i] * y[i];
            sxy += x[i] * y[i];
        }
        if (n < 3) {
            return null;
        }
        double cov = sxy - sx * sy / n, vx = sxx - sx * sx / n, vy = syy - sy * sy / n;
        return vx <= 0 || vy <= 0 ? null : cov / Math.sqrt(vx * vy);
    }
}
