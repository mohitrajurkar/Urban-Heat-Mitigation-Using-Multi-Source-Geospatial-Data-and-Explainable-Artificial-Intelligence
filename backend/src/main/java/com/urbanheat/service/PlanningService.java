package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.urbanheat.dto.PageResponse;
import com.urbanheat.dto.ViewDtos.*;
import com.urbanheat.entity.*;
import com.urbanheat.repository.*;
import com.urbanheat.util.Maps;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Mitigation recommendations, cost analysis, budget planning and transparent priority scoring. */
@Service
@RequiredArgsConstructor
public class PlanningService {
    public static final List<String> STRATEGIES = List.of("tree_plantation", "urban_forest", "cool_roofs", "cool_pavements", "water_bodies");
    private final AnalysisService analysis;
    private final MitigationRecommendationRepository recommendations;
    private final CostEstimateRepository costs;
    private final PriorityRankingRepository rankings;
    private final SettingsService settings;
    private final AiServiceClient ai;
    private final ObjectMapper mapper;

    private List<RecommendationRow> allRows(Long runId) {
        Map<Long, CostEstimate> c = costs.findByRunWithRecommendation(runId).stream()
                .collect(Collectors.toMap(x -> x.getRecommendation().getId(), Function.identity()));
        return recommendations.findByRunWithRegion(runId).stream().map(m -> RecommendationRow.from(m, c.get(m.getId()))).toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<RecommendationRow> list(Long runId, String type, String priority, String search, String sort, int page, int size) {
        AnalysisRun run = analysis.resolveRun(runId);
        String q = InsightService.norm(search);
        List<RecommendationRow> rows = allRows(run.getId()).stream()
                .filter(r -> type == null || type.isBlank() || type.equals(r.type()))
                .filter(r -> priority == null || priority.isBlank() || priority.equalsIgnoreCase(r.priorityLevel()))
                .filter(r -> q.isEmpty() || r.regionName().toLowerCase().contains(q) || r.name().toLowerCase().contains(q) || r.regionCode().toLowerCase().contains(q))
                .sorted(recComparator(sort))
                .toList();
        return PageResponse.of(rows, page, size);
    }

    private static final Map<String, Integer> LEVEL_ORDER = Map.of("Critical", 4, "High", 3, "Medium", 2, "Low", 1);

    private Comparator<RecommendationRow> recComparator(String sort) {
        String s = sort == null ? "effectiveness,asc" : sort;
        boolean asc = s.endsWith(",asc");
        Comparator<RecommendationRow> c = switch (s.split(",")[0]) {
            case "cost" -> Comparator.comparing(r -> r.cost() == null ? 0 : r.cost().estimated());
            case "cooling" -> Comparator.comparing(RecommendationRow::coolingC);
            case "area" -> Comparator.comparing(RecommendationRow::areaM2);
            case "priority" -> Comparator.comparing(r -> LEVEL_ORDER.getOrDefault(r.priorityLevel(), 0));
            default -> Comparator.comparing(r -> r.costEffectivenessRank() == null ? Integer.MAX_VALUE : r.costEffectivenessRank());
        };
        return asc ? c : c.reversed();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(Long runId) {
        AnalysisRun run = analysis.resolveRun(runId);
        List<RecommendationRow> rows = allRows(run.getId());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("runId", run.getId());
        out.put("summary", run.getRecommendationSummary());
        out.put("byPriority", rows.stream().collect(Collectors.groupingBy(RecommendationRow::priorityLevel, TreeMap::new, Collectors.counting())));
        out.put("total", rows.size());
        return out;
    }

    @Transactional(readOnly = true)
    public JsonNode assumptions(Long runId) {
        try {
            AnalysisRun run = analysis.resolveRun(runId);
            JsonNode a = run.getRecommendationSummary() == null ? null : run.getRecommendationSummary().get("assumptions");
            if (a != null) {
                return a;
            }
        } catch (RuntimeException ignored) {
            // no completed run yet -> fall back to the live AI configuration
        }
        return ai.recommendationConfig();
    }

    // ------------------------------------------------------------------ cost analysis
    @Transactional(readOnly = true)
    public Map<String, Object> costSummary(Long runId) {
        AnalysisRun run = analysis.resolveRun(runId);
        List<RecommendationRow> rows = allRows(run.getId());
        List<Map<String, Object>> byType = new ArrayList<>();
        for (String t : STRATEGIES) {
            List<RecommendationRow> sel = rows.stream().filter(r -> r.type().equals(t)).toList();
            if (sel.isEmpty()) {
                byType.add(Maps.of("type", t, "name", prettyName(t), "count", 0, "totalCost", 0.0, "costLow", 0.0, "costHigh", 0.0,
                        "totalAreaM2", 0.0, "meanCoolingC", 0.0, "maxCoolingC", 0.0, "meanCostPerDegree", null, "unitCost", null, "unit", null));
                continue;
            }
            double total = sel.stream().mapToDouble(r -> r.cost().estimated()).sum();
            byType.add(Maps.of("type", t, "name", sel.get(0).name(), "count", sel.size(), "totalCost", total,
                    "costLow", sel.stream().mapToDouble(r -> r.cost().low()).sum(),
                    "costHigh", sel.stream().mapToDouble(r -> r.cost().high()).sum(),
                    "totalAreaM2", sel.stream().mapToDouble(RecommendationRow::areaM2).sum(),
                    "meanCoolingC", sel.stream().mapToDouble(RecommendationRow::coolingC).average().orElse(0),
                    "maxCoolingC", sel.stream().mapToDouble(RecommendationRow::coolingC).max().orElse(0),
                    "meanCostPerDegree", sel.stream().map(r -> r.cost().costPerDegree()).filter(Objects::nonNull).mapToDouble(Double::doubleValue).average().orElse(Double.NaN),
                    "unitCost", sel.get(0).cost().unitCost(), "unit", sel.get(0).unit(), "unitCostBasis", sel.get(0).cost().unitCostBasis()));
        }
        List<Map<String, Object>> scatter = new ArrayList<>();
        int step = Math.max(1, rows.size() / 500);
        for (int i = 0; i < rows.size(); i += step) {
            RecommendationRow r = rows.get(i);
            scatter.add(Maps.of("type", r.type(), "name", r.name(), "region", r.regionName(), "cost", r.cost().estimated(), "cooling", r.coolingC()));
        }
        double total = rows.stream().mapToDouble(r -> r.cost().estimated()).sum();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("runId", run.getId());
        out.put("currency", "INR");
        out.put("approximate", true);
        out.put("note", "Approximate planning estimates (±25%). See assumptions for unit costs and cooling models.");
        out.put("totalCost", total);
        out.put("totalCostLow", rows.stream().mapToDouble(r -> r.cost().low()).sum());
        out.put("totalCostHigh", rows.stream().mapToDouble(r -> r.cost().high()).sum());
        out.put("count", rows.size());
        out.put("byType", byType);
        out.put("scatter", scatter);
        return out;
    }

    /** Greedy budget allocation by cost-effectiveness (INR per °C); optionally one intervention per region. */
    @Transactional(readOnly = true)
    public Map<String, Object> budgetPlan(BudgetPlanRequest req) {
        AnalysisRun run = analysis.resolveRun(req.runId());
        Set<String> allowed = req.strategies() == null || req.strategies().isEmpty() ? new HashSet<>(STRATEGIES) : new HashSet<>(req.strategies());
        boolean onePerRegion = req.onePerRegion() == null || req.onePerRegion();
        List<RecommendationRow> candidates = allRows(run.getId()).stream()
                .filter(r -> allowed.contains(r.type()) && r.cost() != null && r.cost().costPerDegree() != null)
                .sorted(Comparator.comparing((RecommendationRow r) -> r.cost().costPerDegree()))
                .toList();
        double remaining = req.budgetInr();
        Set<Long> regionsUsed = new HashSet<>();
        List<RecommendationRow> selected = new ArrayList<>();
        for (RecommendationRow r : candidates) {
            if (onePerRegion && regionsUsed.contains(r.regionId())) {
                continue;
            }
            if (r.cost().estimated() <= remaining) {
                selected.add(r);
                remaining -= r.cost().estimated();
                regionsUsed.add(r.regionId());
            }
        }
        Map<String, Long> byType = selected.stream().collect(Collectors.groupingBy(RecommendationRow::type, TreeMap::new, Collectors.counting()));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("budget", req.budgetInr());
        out.put("allocated", req.budgetInr() - remaining);
        out.put("remaining", remaining);
        out.put("interventions", selected.size());
        out.put("regionsCovered", regionsUsed.size());
        out.put("sumOfLocalCoolingC", selected.stream().mapToDouble(RecommendationRow::coolingC).sum());
        out.put("meanLocalCoolingC", selected.stream().mapToDouble(RecommendationRow::coolingC).average().orElse(0));
        out.put("byType", byType);
        out.put("method", "Greedy selection in ascending cost per °C of local LST reduction" + (onePerRegion ? ", at most one intervention per region" : ""));
        out.put("selected", selected.stream().limit(300).toList());
        return out;
    }

    // ------------------------------------------------------------------ priorities
    @Transactional(readOnly = true)
    public PageResponse<Map<String, Object>> priorities(Long runId, String level, int page, int size) {
        AnalysisRun run = analysis.resolveRun(runId);
        List<Map<String, Object>> rows = rankings.findByRunWithRegion(run.getId()).stream()
                .filter(p -> level == null || level.isBlank() || level.equalsIgnoreCase(p.getPriorityLevel()))
                .map(p -> Maps.of("regionId", p.getRegion().getId(), "hotspotId", p.getHotspot().getId(), "regionCode", p.getRegion().getRegionCode(),
                        "name", p.getRegion().getName(), "locality", p.getRegion().getLocality(), "severity", p.getHotspot().getSeverity(),
                        "lst", p.getHotspot().getLst(), "priority", PriorityDto.from(p)))
                .toList();
        return PageResponse.of(rows, page, size);
    }

    @Transactional
    public Map<String, Object> recalculate(Long runId, Map<String, Double> weights) {
        AnalysisRun run = analysis.resolveRun(runId);
        settings.setPriorityWeights(weights);
        List<Map<String, Object>> levels = priorityLevels(run);
        List<PriorityRanking> list = new ArrayList<>(rankings.findByRunWithRegion(run.getId()));
        JsonNode w = mapper.valueToTree(weights);
        for (PriorityRanking p : list) {
            double score = 100 * (weights.get("heat_severity") * p.getHeatScore()
                    + weights.get("population_vulnerability") * p.getVulnerabilityScore()
                    + weights.get("vegetation_deficit") * p.getVegetationDeficitScore()
                    + weights.get("implementation_feasibility") * p.getFeasibilityScore()
                    + weights.get("cooling_benefit") * p.getCoolingBenefitScore());
            p.setScore(Math.round(score * 100) / 100.0);
            p.setWeights(w);
            p.setPriorityLevel(levelFor(p.getScore(), levels));
        }
        list.sort(Comparator.comparing(PriorityRanking::getScore).reversed());
        Map<String, Long> counts = new TreeMap<>();
        Map<String, List<Long>> regionsByLevel = new HashMap<>();
        for (int i = 0; i < list.size(); i++) {
            PriorityRanking p = list.get(i);
            p.setRank(i + 1);
            regionsByLevel.computeIfAbsent(p.getPriorityLevel(), k -> new ArrayList<>()).add(p.getRegion().getId());
            counts.merge(p.getPriorityLevel(), 1L, Long::sum);
        }
        rankings.saveAll(list);
        rankings.flush();
        regionsByLevel.forEach((lvl, ids) -> recommendations.updatePriorityLevel(ids, lvl));
        return Maps.of("runId", run.getId(), "weights", weights, "rankedHotspots", list.size(), "levels", counts);
    }

    private List<Map<String, Object>> priorityLevels(AnalysisRun run) {
        JsonNode lv = run.getRecommendationSummary() == null ? null : run.getRecommendationSummary().path("assumptions").get("priority_levels");
        List<Map<String, Object>> out = new ArrayList<>();
        if (lv != null && lv.isArray()) {
            lv.forEach(l -> out.add(Maps.of("level", l.get("level").asText(), "min", l.get("min_score").asDouble())));
        } else {
            out.add(Maps.of("level", "Critical", "min", 80.0));
            out.add(Maps.of("level", "High", "min", 70.0));
            out.add(Maps.of("level", "Medium", "min", 55.0));
            out.add(Maps.of("level", "Low", "min", 0.0));
        }
        out.sort(Comparator.comparing((Map<String, Object> m) -> (Double) m.get("min")).reversed());
        return out;
    }

    static String levelFor(double score, List<Map<String, Object>> levels) {
        for (Map<String, Object> l : levels) {
            if (score >= (Double) l.get("min")) {
                return (String) l.get("level");
            }
        }
        return "Low";
    }

    static String prettyName(String type) {
        return switch (type) {
            case "tree_plantation" -> "Tree Plantation";
            case "urban_forest" -> "Urban Forest Development";
            case "cool_roofs" -> "Cool Roofs";
            case "cool_pavements" -> "Cool Pavements";
            case "water_bodies" -> "Water Bodies";
            default -> type;
        };
    }
}
