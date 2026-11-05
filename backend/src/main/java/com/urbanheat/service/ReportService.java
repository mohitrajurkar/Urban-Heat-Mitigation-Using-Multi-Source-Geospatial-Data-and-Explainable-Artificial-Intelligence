package com.urbanheat.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import com.urbanheat.dto.ViewDtos.*;
import com.urbanheat.entity.AnalysisRun;
import com.urbanheat.entity.Report;
import com.urbanheat.entity.User;
import com.urbanheat.exception.ApiException;
import com.urbanheat.repository.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.List;

/** Generates the downloadable analytical PDF report (OpenPDF) from data stored in PostgreSQL. */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReportService {
    private static final Color FOREST = new Color(0x14, 0x53, 0x2d);
    private static final Color EMERALD = new Color(0x05, 0x96, 0x69);
    private static final Color MINT = new Color(0xec, 0xfd, 0xf5);
    private static final Color GREY = new Color(0xf3, 0xf4, 0xf6);
    private static final Color CHARCOAL = new Color(0x1f, 0x29, 0x37);
    private static final Color AMBER_BG = new Color(0xff, 0xfb, 0xeb);
    private static final Font H1 = new Font(Font.HELVETICA, 16, Font.BOLD, FOREST);
    private static final Font H2 = new Font(Font.HELVETICA, 12, Font.BOLD, EMERALD);
    private static final Font BODY = new Font(Font.HELVETICA, 9.5f, Font.NORMAL, CHARCOAL);
    private static final Font SMALL = new Font(Font.HELVETICA, 8, Font.NORMAL, CHARCOAL);
    private static final Font BOLD = new Font(Font.HELVETICA, 9.5f, Font.BOLD, CHARCOAL);
    private static final Font TH = new Font(Font.HELVETICA, 8.5f, Font.BOLD, Color.WHITE);
    private static final Font TD = new Font(Font.HELVETICA, 8.5f, Font.NORMAL, CHARCOAL);

    private final ReportRepository reports;
    private final AnalysisService analysis;
    private final DashboardService dashboard;
    private final InsightService insight;
    private final PlanningService planning;
    private final AiServiceClient ai;
    private final ObjectMapper mapper;

    @Transactional
    public Map<String, Object> generate(ReportRequest req, User user) {
        AnalysisRun run = analysis.resolveRun(req.runId());
        byte[] pdf = render(run, req.title(), user);
        Report r = new Report();
        r.setRun(run);
        r.setTitle(req.title());
        r.setFileName("UHI_Report_" + run.getStudyArea().getCode() + "_run" + run.getId() + "_"
                + OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")) + ".pdf");
        r.setFileSize((long) pdf.length);
        r.setContent(pdf);
        r.setGeneratedBy(user);
        r.setSections(mapper.valueToTree(List.of("Project information", "Study area", "Dataset sources", "Environmental indicators",
                "Hotspot analysis", "AI model performance", "Prediction results", "SHAP explanations", "Mitigation recommendations",
                "Implementation costs", "Cooling benefits", "Final observations")));
        reports.save(r);
        log.info("Generated report {} ({} KB)", r.getFileName(), pdf.length / 1024);
        return Map.of("id", r.getId(), "fileName", r.getFileName(), "fileSize", r.getFileSize(), "title", r.getTitle());
    }

    @Transactional(readOnly = true)
    public List<ReportRepository.ReportSummary> list() {
        return reports.findSummaries();
    }

    @Transactional(readOnly = true)
    public Report get(Long id) {
        Report r = reports.findById(id).orElseThrow(() -> ApiException.notFound("Report " + id));
        r.getContent(); // initialise lazy column inside the transaction
        return r;
    }

    @Transactional
    public void delete(Long id) {
        if (!reports.existsById(id)) {
            throw ApiException.notFound("Report " + id);
        }
        reports.deleteById(id);
    }

    // ------------------------------------------------------------------ rendering
    @SuppressWarnings("unchecked")
    byte[] render(AnalysisRun run, String title, User user) {
        Map<String, Object> dash = dashboard.stats(run.getId());
        Map<String, Object> kpis = (Map<String, Object>) dash.get("kpis");
        Map<String, Object> eval = insight.evaluation(run.getId());
        Map<String, Object> cost = planning.costSummary(run.getId());
        JsonNode pre = run.getPreprocessingSummary();
        JsonNode feat = run.getFeatureSummary();
        JsonNode hsum = run.getHotspotSummary();
        JsonNode shapG = run.getShapGlobal();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        Document doc = new Document(PageSize.A4, 42, 42, 50, 50);
        try {
            PdfWriter writer = PdfWriter.getInstance(doc, out);
            writer.setPageEvent(new Footer(title));
            writer.setStrictImageSequence(true); // keep figures before their captions
            doc.addTitle(title);
            doc.addAuthor(user.getFullName());
            doc.addSubject("Urban Heat Island analysis - " + run.getStudyArea().getName());
            doc.open();

            // ---------------- cover
            Paragraph cover = new Paragraph();
            cover.setSpacingBefore(120);
            cover.add(new Paragraph("URBAN HEAT MITIGATION DECISION SUPPORT SYSTEM", new Font(Font.HELVETICA, 10, Font.BOLD, EMERALD)));
            cover.add(new Paragraph(title, new Font(Font.HELVETICA, 24, Font.BOLD, FOREST)));
            cover.add(new Paragraph("Urban Heat Mitigation Using Multi-Source Geospatial Data and Explainable Artificial Intelligence",
                    new Font(Font.HELVETICA, 12, Font.NORMAL, CHARCOAL)));
            cover.add(Chunk.NEWLINE);
            doc.add(cover);
            doc.add(kv(new String[][]{
                    {"Study area", run.getStudyArea().getName() + ", " + run.getStudyArea().getState() + ", " + run.getStudyArea().getCountry()},
                    {"Analysis run", "#" + run.getId() + " (" + run.getAiRunId() + ")"},
                    {"Completed", run.getCompletedAt() == null ? "-" : run.getCompletedAt().format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm 'UTC'"))},
                    {"Report generated", OffsetDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm"))},
                    {"Generated by", user.getFullName() + " (" + user.getRole() + ")"},
                    {"Project type", "Final Year B.Tech Computer Science Engineering Project"}}));
            if (run.isDemo()) {
                doc.add(notice("DEMONSTRATION DATA NOTICE: this analysis uses the bundled SYNTHETIC demonstration datasets for Nagpur. "
                        + "They are generated to have scientifically reasonable relationships but are NOT real satellite or ground observations. "
                        + "Model metrics, hotspots, costs and cooling values therefore illustrate the method, not actual conditions in Nagpur."));
            }
            doc.newPage();

            // ---------------- 1 project information
            section(doc, "1. Project Information");
            para(doc, "This decision support system identifies Urban Heat Island (UHI) hotspots from multi-source geospatial data, explains the "
                    + "drivers of land surface temperature with explainable AI (SHAP), and recommends, costs and prioritises mitigation strategies.");
            bullets(doc, List.of(
                    "Pipeline: data collection -> preprocessing (CRS conversion, resampling, cleaning) -> indicator extraction (LST, NDVI, NDBI, NDWI, albedo, LULC) "
                            + "-> Random Forest & XGBoost -> SHAP -> hotspot detection -> recommendations -> cost & cooling estimation -> prioritisation.",
                    "Technology: React + TypeScript + Leaflet dashboard, Spring Boot (JWT, JPA/Hibernate), Python FastAPI (scikit-learn, XGBoost, SHAP, Rasterio, GeoPandas), PostgreSQL + PostGIS.",
                    "All results in this report are read from the PostgreSQL/PostGIS database populated by the analysis run."));

            // ---------------- 2 study area
            section(doc, "2. Study Area Details");
            var sa = StudyAreaDto.from(run.getStudyArea());
            JsonNode grid = pre == null ? null : pre.get("grid");
            doc.add(kv(new String[][]{
                    {"City", sa.city() + ", " + sa.state()},
                    {"Extent (WGS 84)", String.format(Locale.ROOT, "%.2f-%.2f E, %.2f-%.2f N", sa.bbox()[0], sa.bbox()[2], sa.bbox()[1], sa.bbox()[3])},
                    {"Processing CRS", "EPSG:" + sa.processingEpsg() + " (WGS 84 / UTM zone 44N)"},
                    {"Pixel size / analysis cell", sa.resolutionM() + " m / " + sa.cellSizeM() + " m x " + sa.cellSizeM() + " m"},
                    {"Grid", grid == null ? "-" : grid.path("width").asInt() + " x " + grid.path("height").asInt() + " pixels, " + kpis.get("totalRegions") + " analysis regions"},
                    {"Population in extent", fmtInt(feat == null ? null : feat.path("total_population").asDouble())}}));

            // ---------------- 3 datasets
            section(doc, "3. Dataset Sources");
            PdfPTable dt = table(new float[]{2.2f, 1, 3, 1.3f, 1}, "Role", "Dataset", "Source", "Date", "Status");
            if (pre != null && pre.has("datasets")) {
                pre.get("datasets").fields().forEachRemaining(e -> {
                    JsonNode d = e.getValue();
                    cells(dt, e.getKey(), d.path("name").asText(), d.path("source").asText(), d.path("collection_date").asText("-"),
                            d.path("is_demo").asBoolean() ? "SYNTHETIC DEMO" : "Real");
                });
            }
            doc.add(dt);
            if (pre != null) {
                para(doc, String.format(Locale.ROOT, "Preprocessing: %s. Valid Landsat pixels %.1f%% (%d invalid / fill / saturated pixels masked). "
                                + "Sentinel-2 fused over %.1f%% of the grid. Meteorology: %d stations, %d duplicates and %d physically impossible values removed, "
                                + "gaps interpolated, IDW to grid.",
                        pre.path("landsat").path("calibration").asText(), pre.path("landsat").path("valid_pixel_pct").asDouble(),
                        pre.path("landsat").path("invalid_pixels").asInt(), pre.path("sentinel2").path("coverage_pct").asDouble(0),
                        pre.path("meteorological").path("stations").asInt(), pre.path("meteorological").path("duplicates_removed").asInt(),
                        pre.path("meteorological").path("range_violations_removed").asInt()));
            }

            // ---------------- 4 indicators
            section(doc, "4. Environmental Indicator Results");
            PdfPTable it = table(new float[]{2, 1, 1, 1, 1, 1, 1}, "Indicator", "Mean", "Min", "Max", "Std", "P10", "P90");
            String[][] names = {{"lst", "LST (°C)"}, {"ndvi", "NDVI"}, {"ndbi", "NDBI"}, {"ndwi", "NDWI"}, {"albedo", "Surface albedo"}};
            for (String[] n : names) {
                JsonNode s = feat == null ? null : feat.path("indicators").get(n[0]);
                if (s != null && !s.isNull()) {
                    cells(it, n[1], f2(s.get("mean")), f2(s.get("min")), f2(s.get("max")), f2(s.get("std")), f2(s.get("p10")), f2(s.get("p90")));
                }
            }
            doc.add(it);
            if (feat != null && feat.has("lulc_distribution")) {
                PdfPTable lt = table(new float[]{3, 1, 1}, "Land use / land cover class", "Share of area", "Mean LST (°C)");
                feat.get("lulc_distribution").forEach(l -> cells(lt, l.path("label").asText(), pct(l.path("fraction").asDouble()), f2(l.get("mean_lst"))));
                doc.add(lt);
            }
            image(doc, safeBytes(() -> ai.layerPng(run.getAiRunId(), "lst")), 330, "Figure 1. Land surface temperature (pixel level, 100 m). Blue = cooler, red = hotter.");

            // ---------------- 5 hotspots
            section(doc, "5. Hotspot Analysis");
            if (hsum != null) {
                JsonNode t = hsum.get("thresholds");
                para(doc, String.format(Locale.ROOT, "Severity classes use the documented rule on cell-mean LST (mean = %.2f °C, SD = %.2f °C): Low < %.2f °C <= Moderate < %.2f °C <= High < %.2f °C <= Very High. "
                                + "%d of %s regions are hotspots (High or Very High); %d hotspots are statistically significant spatial clusters (Getis-Ord Gi* z >= 1.96).",
                        t.path("mean").asDouble(), t.path("std").asDouble(), t.path("low_moderate").asDouble(), t.path("moderate_high").asDouble(),
                        t.path("high_very_high").asDouble(), hsum.path("n_hotspots").asInt(), kpis.get("totalRegions"), hsum.path("n_significant_gi_star").asInt()));
            }
            PdfPTable st = table(new float[]{1, 1, 1, 1}, "Low", "Moderate", "High", "Very High");
            List<Map<String, Object>> sevs = (List<Map<String, Object>>) dash.get("severityDistribution");
            cells(st, sevs.stream().map(m -> String.valueOf(m.get("count"))).toArray(String[]::new));
            doc.add(st);
            para(doc, "Top priority hotspots (priority score = weighted sum of heat severity, population vulnerability, vegetation deficit, feasibility and cooling benefit):");
            PdfPTable ht = table(new float[]{0.5f, 2.4f, 1, 0.9f, 0.9f, 1, 1.2f}, "#", "Region", "Severity", "LST °C", "Score", "Level", "Gi* z");
            var top = insight.hotspotRows(run.getId(), null, null, false, false, null, "priority,desc", 0, 15).content();
            for (HotspotRow h : top) {
                cells(ht, String.valueOf(h.priority() == null ? "-" : h.priority().rank()), h.name(), h.severity(), f1(h.lst()),
                        h.priority() == null ? "-" : f1(h.priority().score()), h.priority() == null ? "-" : h.priority().level(), f2(h.giStarZ()));
            }
            doc.add(ht);

            // ---------------- 6 model performance
            section(doc, "6. AI Model Performance");
            JsonNode es = (JsonNode) mapper.valueToTree(eval.get("summary"));
            para(doc, String.format(Locale.ROOT, "Models were trained on %d labelled regions with a spatial block hold-out (%d train / %d test). "
                            + "Features: %s. Leakage controls: %s.",
                    es.path("n_labelled_regions").asInt(), es.path("train_samples").asInt(), es.path("test_samples").asInt(),
                    String.join(", ", textList(es.get("feature_labels"), true)), String.join("; ", textList(es.get("leakage_controls"), false))));
            PdfPTable mt = table(new float[]{1.6f, 1, 1, 1, 1, 1.2f, 0.9f, 0.9f, 0.9f, 1.1f}, "Model", "Accuracy", "Precision", "Recall", "F1", "CV F1", "R²", "RMSE", "MAE", "CV R²");
            List<EvaluationDto> evs = (List<EvaluationDto>) eval.get("models");
            for (String m : List.of("random_forest", "xgboost")) {
                EvaluationDto c = evs.stream().filter(e -> e.modelName().equals(m) && e.task().equals("classification")).findFirst().orElse(null);
                EvaluationDto r = evs.stream().filter(e -> e.modelName().equals(m) && e.task().equals("regression")).findFirst().orElse(null);
                if (c != null && r != null) {
                    cells(mt, m.equals("xgboost") ? "XGBoost" : "Random Forest", f3(c.accuracy()), f3(c.precision()), f3(c.recall()), f3(c.f1()),
                            f3(c.cvMean()) + " ± " + f3(c.cvStd()), f3(r.r2()), f2(r.rmse()), f2(r.mae()), f3(r.cvMean()));
                }
            }
            doc.add(mt);
            evs.stream().filter(e -> e.task().equals("classification") && e.best()).findFirst().ifPresent(best -> {
                para(doc, "Confusion matrix of the best classifier (" + best.modelName() + ") on the spatial test set (rows = observed, columns = predicted):");
                PdfPTable cm = table(new float[]{1.3f, 1, 1, 1, 1}, "Observed \\ Predicted", "Low", "Moderate", "High", "Very High");
                String[] cls = {"Low", "Moderate", "High", "Very High"};
                for (int i = 0; i < 4 && best.confusionMatrix() != null; i++) {
                    JsonNode row = best.confusionMatrix().get(i);
                    cells(cm, cls[i], row.get(0).asText(), row.get(1).asText(), row.get(2).asText(), row.get(3).asText());
                }
                doc.add(cm);
            });

            // ---------------- 7 predictions
            section(doc, "7. Prediction Results");
            JsonNode counts = mapper.createObjectNode();
            var preds = insight.predictionRows(run.getId(), null, null, false, 0, 10000).content();
            Map<String, Long> byClass = new TreeMap<>();
            preds.forEach(p -> p.models().values().stream().filter(PredictionModelView::bestModel).findFirst()
                    .ifPresent(v -> byClass.merge(v.predictedClass(), 1L, Long::sum)));
            para(doc, "Predicted heat severity of all " + preds.size() + " regions by the best classifier: " + byClass
                    + ". Regions whose LST could not be observed (data gaps) are classified by the model from their non-thermal features.");
            PdfPTable pt = table(new float[]{2.4f, 1, 1.1f, 1, 1.1f, 1}, "Region", "Observed LST", "Observed class", "RF class", "XGB class", "XGB LST");
            for (PredictionRow p : preds.subList(0, Math.min(12, preds.size()))) {
                PredictionModelView rf = p.models().get("random_forest"), xg = p.models().get("xgboost");
                cells(pt, p.name(), f1(p.observedLst()), Objects.toString(p.observedClass(), "-"), rf == null ? "-" : rf.predictedClass(),
                        xg == null ? "-" : xg.predictedClass(), xg == null ? "-" : f1(xg.predictedLst()));
            }
            doc.add(pt);
            Objects.requireNonNull(counts);

            // ---------------- 8 SHAP
            section(doc, "8. SHAP Explanations");
            if (shapG != null) {
                JsonNode imp = shapG.path("global").path("xgboost").path("regression").path("importance");
                PdfPTable sht = table(new float[]{3, 1.4f}, "Feature (XGBoost LST model)", "Mean |SHAP| (°C)");
                for (int i = 0; i < Math.min(10, imp.size()); i++) {
                    cells(sht, imp.get(i).path("label").asText(), f3(imp.get(i).get("mean_abs_shap")));
                }
                doc.add(sht);
            }
            image(doc, safeBytes(() -> ai.shapPlot(run.getAiRunId(), "summary_xgboost_regression.png")), 400,
                    "Figure 2. SHAP summary (beeswarm) - each dot is a region; colour = feature value, x = contribution to predicted LST (°C).");
            para(doc, "Individual explanations for the three highest-priority hotspots (generated from their SHAP values):");
            for (HotspotRow h : top.subList(0, Math.min(3, top.size()))) {
                insight.explanationFor(h.regionId()).ifPresent(e -> bullets(doc, List.of(e.explanation())));
            }

            // ---------------- 9 recommendations
            section(doc, "9. Mitigation Recommendations");
            List<Map<String, Object>> byType = (List<Map<String, Object>>) cost.get("byType");
            PdfPTable rt = table(new float[]{2.2f, 0.8f, 1.3f, 1.2f, 1.6f}, "Strategy", "Count", "Total area (ha)", "Mean cooling °C", "Mean cost / °C (Rs  lakh)");
            for (Map<String, Object> t : byType) {
                cells(rt, String.valueOf(t.get("name")), String.valueOf(t.get("count")), f1(d(t.get("totalAreaM2")) / 1e4), f2(d(t.get("meanCoolingC"))),
                        t.get("meanCostPerDegree") == null ? "-" : f1(d(t.get("meanCostPerDegree")) / 1e5));
            }
            doc.add(rt);
            para(doc, "Most cost-effective individual recommendations:");
            PdfPTable rr = table(new float[]{1.6f, 2, 3.4f, 1, 1.1f, 0.9f}, "Intervention", "Location", "Reason", "Cost (Rs  lakh)", "Cooling °C", "Priority");
            for (RecommendationRow r : planning.list(run.getId(), null, null, null, "effectiveness,asc", 0, 12).content()) {
                cells(rr, r.name(), r.regionName() + String.format(Locale.ROOT, " (%.4f, %.4f)", r.lat(), r.lon()), r.reason(),
                        f1(r.cost().estimated() / 1e5), f2(r.coolingC()), r.priorityLevel());
            }
            doc.add(rr);

            // ---------------- 10 costs
            section(doc, "10. Estimated Implementation Costs");
            para(doc, String.format(Locale.ROOT, "Implementing all %s recommendations would cost approximately Rs %.2f crore (range Rs %.2f-%.2f crore). "
                            + "All costs are APPROXIMATE planning estimates (±25%%) based on the unit costs below; replace them with municipal schedule-of-rates values for real budgeting.",
                    cost.get("count"), d(cost.get("totalCost")) / 1e7, d(cost.get("totalCostLow")) / 1e7, d(cost.get("totalCostHigh")) / 1e7));
            PdfPTable ct = table(new float[]{2, 1.2f, 1.2f, 1.2f, 1, 3}, "Strategy", "Total (Rs  cr)", "Low (Rs  cr)", "High (Rs  cr)", "Unit cost (Rs )", "Unit cost basis");
            for (Map<String, Object> t : byType) {
                cells(ct, String.valueOf(t.get("name")), f2(d(t.get("totalCost")) / 1e7), f2(d(t.get("costLow")) / 1e7), f2(d(t.get("costHigh")) / 1e7),
                        t.get("unitCost") == null ? "-" : fmtInt(d(t.get("unitCost"))) + " / " + t.get("unit"), Objects.toString(t.get("unitCostBasis"), "-"));
            }
            doc.add(ct);

            // ---------------- 11 cooling
            section(doc, "11. Expected Cooling Benefits");
            para(doc, String.format(Locale.ROOT, "Expected cooling is the estimated reduction of the analysis-cell mean LST from linear coverage models capped per strategy. "
                            + "Across the ranked hotspots the combined expected cooling averages %.2f °C per region (diminishing-returns combination of up to three interventions, capped at 5 °C). "
                            + "About %s residents live in hotspot regions.",
                    d(kpis.get("meanExpectedCoolingC")), fmtInt(d(kpis.get("populationExposed")))));
            PdfPTable cl = table(new float[]{2.4f, 1, 1, 1}, "Strategy", "Mean cooling °C", "Max cooling °C", "Recommendations");
            for (Map<String, Object> t : byType) {
                cells(cl, String.valueOf(t.get("name")), f2(d(t.get("meanCoolingC"))), f2(d(t.get("maxCoolingC"))), String.valueOf(t.get("count")));
            }
            doc.add(cl);

            // ---------------- 12 observations
            section(doc, "12. Final Observations");
            bullets(doc, observations(dash, kpis, byType, shapG, evs));
            if (run.isDemo()) {
                doc.add(notice("These observations describe the synthetic demonstration dataset. Replace the demo datasets with real Landsat 8/9, "
                        + "Sentinel-2, LULC, population and meteorological data (Dataset Management) to obtain findings for the real city."));
            }
            doc.close();
        } catch (DocumentException e) {
            throw new IllegalStateException("PDF generation failed: " + e.getMessage(), e);
        }
        return out.toByteArray();
    }

    private List<String> observations(Map<String, Object> dash, Map<String, Object> kpis, List<Map<String, Object>> byType, JsonNode shapG, List<EvaluationDto> evs) {
        List<String> obs = new ArrayList<>();
        obs.add(String.format(Locale.ROOT, "%s of %s analysis regions (%.1f%%) are heat hotspots; %s are classified Very High. Mean LST is %.1f °C with a maximum of %.1f °C.",
                kpis.get("totalHotspots"), kpis.get("totalRegions"), 100.0 * d(kpis.get("totalHotspots")) / Math.max(1, d(kpis.get("totalRegions"))),
                kpis.get("veryHighHotspots"), d(kpis.get("averageLst")), d(kpis.get("maxLst"))));
        if (shapG != null) {
            JsonNode imp = shapG.path("global").path("xgboost").path("regression").path("importance");
            if (imp.size() >= 3) {
                obs.add("According to global SHAP importance, the strongest drivers of land surface temperature are " + imp.get(0).path("label").asText()
                        + ", " + imp.get(1).path("label").asText() + " and " + imp.get(2).path("label").asText() + ".");
            }
        }
        evs.stream().filter(e -> e.best() && e.task().equals("classification")).findFirst().ifPresent(e ->
                obs.add(String.format(Locale.ROOT, "%s is the best severity classifier on the spatial hold-out (macro F1 %.3f, accuracy %.3f).", label(e.modelName()), e.f1(), e.accuracy())));
        evs.stream().filter(e -> e.best() && e.task().equals("regression")).findFirst().ifPresent(e ->
                obs.add(String.format(Locale.ROOT, "%s predicts cell LST with R² = %.3f and RMSE = %.2f °C on unseen spatial blocks.", label(e.modelName()), e.r2(), e.rmse())));
        byType.stream().filter(t -> t.get("meanCostPerDegree") != null && d(t.get("count")) > 0)
                .min(Comparator.comparing(t -> d(t.get("meanCostPerDegree"))))
                .ifPresent(t -> obs.add(t.get("name") + " is the most cost-effective strategy on average (approx. Rs " + f1(d(t.get("meanCostPerDegree")) / 1e5) + " lakh per °C of local cooling)."));
        byType.stream().max(Comparator.comparing(t -> d(t.get("count"))))
                .ifPresent(t -> obs.add(t.get("name") + " is the most widely applicable intervention (" + t.get("count") + " hotspot regions)."));
        obs.add(String.format(Locale.ROOT, "%s hotspots are rated Critical priority; implementing all recommendations is estimated at Rs %.2f crore.",
                kpis.get("criticalPriorityHotspots"), d(kpis.get("estimatedMitigationCost")) / 1e7));
        return obs;
    }

    // ------------------------------------------------------------------ PDF helpers
    private static String label(String model) {
        return "xgboost".equals(model) ? "XGBoost" : "Random Forest";
    }

    private static double d(Object o) {
        return o instanceof Number n ? n.doubleValue() : 0.0;
    }

    private static String f1(Double v) {
        return v == null || !Double.isFinite(v) ? "-" : String.format(Locale.ROOT, "%.1f", v);
    }

    private static String f2(Double v) {
        return v == null || !Double.isFinite(v) ? "-" : String.format(Locale.ROOT, "%.2f", v);
    }

    private static String f2(JsonNode n) {
        return n == null || n.isNull() ? "-" : f2(n.asDouble());
    }

    private static String f3(Double v) {
        return v == null || !Double.isFinite(v) ? "-" : String.format(Locale.ROOT, "%.3f", v);
    }

    private static String f3(JsonNode n) {
        return n == null || n.isNull() ? "-" : f3(n.asDouble());
    }

    private static String pct(double v) {
        return String.format(Locale.ROOT, "%.1f%%", 100 * v);
    }

    private static String fmtInt(Double v) {
        return v == null || !Double.isFinite(v) ? "-" : String.format(Locale.ROOT, "%,.0f", v);
    }

    private static List<String> textList(JsonNode n, boolean values) {
        List<String> out = new ArrayList<>();
        if (n == null) {
            return out;
        }
        if (n.isArray()) {
            n.forEach(x -> out.add(x.asText()));
        } else {
            n.fields().forEachRemaining(e -> out.add(values ? e.getValue().asText() : e.getKey()));
        }
        return out;
    }

    private interface BytesSupplier {
        byte[] get();
    }

    private static byte[] safeBytes(BytesSupplier s) {
        try {
            return s.get();
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static void section(Document doc, String title) throws DocumentException {
        Paragraph p = new Paragraph(title, H1);
        p.setSpacingBefore(14);
        p.setSpacingAfter(6);
        doc.add(p);
    }

    private static void para(Document doc, String text) {
        Paragraph p = new Paragraph(text, BODY);
        p.setSpacingAfter(6);
        p.setLeading(13);
        doc.add(p);
    }

    private static void bullets(Document doc, List<String> items) {
        com.lowagie.text.List list = new com.lowagie.text.List(false, 10);
        list.setListSymbol(new Chunk("•  ", BOLD));
        items.forEach(i -> list.add(new ListItem(new Phrase(i, BODY))));
        doc.add(list);
        doc.add(new Paragraph(" ", SMALL));
    }

    private static PdfPTable notice(String text) {
        PdfPTable t = new PdfPTable(1);
        t.setWidthPercentage(100);
        t.setSpacingBefore(10);
        t.setSpacingAfter(10);
        PdfPCell c = new PdfPCell(new Phrase(text, BOLD));
        c.setBackgroundColor(AMBER_BG);
        c.setBorderColor(new Color(0xf5, 0x9e, 0x0b));
        c.setPadding(9);
        t.addCell(c);
        return t;
    }

    private static PdfPTable kv(String[][] rows) {
        PdfPTable t = new PdfPTable(new float[]{1.3f, 3});
        t.setWidthPercentage(100);
        t.setSpacingAfter(8);
        for (String[] r : rows) {
            PdfPCell k = new PdfPCell(new Phrase(r[0], BOLD));
            k.setBackgroundColor(MINT);
            k.setBorderColor(GREY);
            k.setPadding(5);
            PdfPCell v = new PdfPCell(new Phrase(r[1], BODY));
            v.setBorderColor(GREY);
            v.setPadding(5);
            t.addCell(k);
            t.addCell(v);
        }
        return t;
    }

    private static PdfPTable table(float[] widths, String... headers) {
        PdfPTable t = new PdfPTable(widths);
        t.setWidthPercentage(100);
        t.setSpacingBefore(4);
        t.setSpacingAfter(10);
        t.setHeaderRows(1);
        for (String h : headers) {
            PdfPCell c = new PdfPCell(new Phrase(h, TH));
            c.setBackgroundColor(FOREST);
            c.setBorderColor(FOREST);
            c.setPadding(5);
            t.addCell(c);
        }
        return t;
    }

    private static void cells(PdfPTable t, String... values) {
        int row = t.getRows().size();
        for (String v : values) {
            PdfPCell c = new PdfPCell(new Phrase(v == null ? "-" : v, TD));
            c.setBorderColor(GREY);
            c.setPadding(4);
            if (row % 2 == 0) {
                c.setBackgroundColor(new Color(0xf9, 0xfa, 0xfb));
            }
            t.addCell(c);
        }
    }

    private static void image(Document doc, byte[] png, float width, String caption) {
        if (png == null) {
            para(doc, "(" + caption + " - image unavailable: AI service not reachable)");
            return;
        }
        try {
            Image img = Image.getInstance(png);
            img.scaleToFit(width, 500);
            img.setAlignment(Element.ALIGN_CENTER);
            img.setBorder(Rectangle.BOX);
            img.setBorderColor(GREY);
            doc.add(img);
            Paragraph p = new Paragraph(caption, SMALL);
            p.setAlignment(Element.ALIGN_CENTER);
            p.setSpacingAfter(8);
            doc.add(p);
        } catch (Exception e) {
            para(doc, "(" + caption + " - image could not be embedded)");
        }
    }

    private static final class Footer extends PdfPageEventHelper {
        private final String title;

        Footer(String title) {
            this.title = title;
        }

        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            PdfContentByte cb = writer.getDirectContent();
            Font f = new Font(Font.HELVETICA, 7.5f, Font.NORMAL, Color.GRAY);
            ColumnText.showTextAligned(cb, Element.ALIGN_LEFT, new Phrase("Urban Heat Mitigation DSS - " + title, f), document.left(), 28, 0);
            ColumnText.showTextAligned(cb, Element.ALIGN_RIGHT, new Phrase("Page " + writer.getPageNumber(), f), document.right(), 28, 0);
            cb.setColorStroke(EMERALD);
            cb.setLineWidth(1.2f);
            cb.moveTo(document.left(), document.top() + 18);
            cb.lineTo(document.right(), document.top() + 18);
            cb.stroke();
        }
    }
}
