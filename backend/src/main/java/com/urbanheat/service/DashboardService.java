package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.urbanheat.dto.AnalysisDtos.RunResponse;
import com.urbanheat.dto.ViewDtos.HotspotRow;
import com.urbanheat.entity.*;
import com.urbanheat.repository.*;
import com.urbanheat.util.Maps;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DashboardService {
    private static final List<String> SEVERITIES = List.of("Low", "Moderate", "High", "Very High");
    private final AnalysisService analysis;
    private final EnvironmentalIndicatorRepository indicators;
    private final HotspotRepository hotspots;
    private final PriorityRankingRepository rankings;
    private final ModelEvaluationRepository evaluations;
    private final InsightService insight;
    private final PlanningService planning;

    public Map<String, Object> stats(Long runId) {
        AnalysisRun run = analysis.resolveRun(runId);
        List<EnvironmentalIndicator> ind = indicators.findByRunWithRegion(run.getId());
        List<Hotspot> hs = hotspots.findByRunWithRegion(run.getId());
        List<PriorityRanking> pr = rankings.findByRunWithRegion(run.getId());
        Map<String, Object> cost = planning.costSummary(run.getId());

        double[] lst = ind.stream().map(EnvironmentalIndicator::getLstMean).filter(Objects::nonNull).mapToDouble(Double::doubleValue).toArray();
        long nHot = hs.stream().filter(Hotspot::isHotspot).count();
        long nVeryHigh = hs.stream().filter(h -> "Very High".equals(h.getSeverity())).count();
        double vegPct = 100 * ind.stream().map(EnvironmentalIndicator::getVegetationFraction).filter(Objects::nonNull).mapToDouble(Double::doubleValue).average().orElse(0);
        Set<Long> hotRegions = hs.stream().filter(Hotspot::isHotspot).map(h -> h.getRegion().getId()).collect(Collectors.toSet());
        double popExposed = ind.stream().filter(i -> hotRegions.contains(i.getRegion().getId()) && i.getPopulation() != null).mapToDouble(EnvironmentalIndicator::getPopulation).sum();

        Map<String, Object> kpis = Maps.of(
                "totalRegions", ind.size(),
                "totalHotspots", nHot,
                "veryHighHotspots", nVeryHigh,
                "averageLst", Arrays.stream(lst).average().orElse(Double.NaN),
                "maxLst", Arrays.stream(lst).max().orElse(Double.NaN),
                "vegetationCoveragePct", vegPct,
                "recommendedInterventions", cost.get("count"),
                "estimatedMitigationCost", cost.get("totalCost"),
                "populationExposed", popExposed,
                "criticalPriorityHotspots", pr.stream().filter(p -> "Critical".equals(p.getPriorityLevel())).count(),
                "meanExpectedCoolingC", pr.stream().map(PriorityRanking::getExpectedCoolingC).filter(Objects::nonNull).mapToDouble(Double::doubleValue).average().orElse(0));

        Map<String, Long> sev = hs.stream().collect(Collectors.groupingBy(Hotspot::getSeverity, Collectors.counting()));
        List<Map<String, Object>> severity = SEVERITIES.stream().map(s -> Maps.of("severity", s, "count", sev.getOrDefault(s, 0L))).toList();

        List<Map<String, Object>> models = evaluations.findByRunIdOrderByModelNameAscTaskAsc(run.getId()).stream()
                .collect(Collectors.groupingBy(ModelEvaluation::getModelName, TreeMap::new, Collectors.toList()))
                .entrySet().stream().map(e -> {
                    Map<String, Object> m = Maps.of("model", e.getKey());
                    for (ModelEvaluation me : e.getValue()) {
                        if ("classification".equals(me.getTask())) {
                            m.putAll(Maps.of("accuracy", me.getAccuracy(), "precision", me.getPrecisionMacro(), "recall", me.getRecallMacro(),
                                    "f1", me.getF1Macro(), "bestClassifier", me.isBest()));
                        } else {
                            m.putAll(Maps.of("r2", me.getR2(), "rmse", me.getRmse(), "mae", me.getMae(), "bestRegressor", me.isBest()));
                        }
                    }
                    return m;
                }).toList();

        Map<Long, EnvironmentalIndicator> byRegion = ind.stream().collect(Collectors.toMap(i -> i.getRegion().getId(), Function.identity()));
        List<HotspotRow> top = pr.stream().limit(8).map(p -> HotspotRow.from(p.getHotspot(), byRegion.get(p.getRegion().getId()), p)).toList();

        Map<String, Object> indSummary = insight.indicatorSummary(run.getId());
        JsonNode feat = run.getFeatureSummary();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("run", RunResponse.from(run));
        out.put("demo", run.isDemo());
        out.put("kpis", kpis);
        out.put("lstHistogram", ((Map<?, ?>) indSummary.get("histograms")).get("lst"));
        out.put("severityDistribution", severity);
        out.put("indicatorsByLulc", indSummary.get("byLulc"));
        out.put("lulcDistribution", feat == null ? null : feat.get("lulc_distribution"));
        out.put("cityIndicators", feat == null ? null : feat.get("indicators"));
        out.put("scatter", indSummary.get("scatter"));
        out.put("modelComparison", models);
        out.put("topHotspots", top);
        out.put("recommendationOverview", cost.get("byType"));
        out.put("datasets", run.getPreprocessingSummary() == null ? null : run.getPreprocessingSummary().get("datasets"));
        return out;
    }
}
