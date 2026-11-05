package com.urbanheat.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.urbanheat.entity.*;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Read models returned by the REST API. */
public final class ViewDtos {
    private ViewDtos() {
    }

    public record StudyAreaDto(Long id, String code, String name, String city, String state, String country, String description,
                               double[] bbox, double[] center, Integer processingEpsg, Integer resolutionM, Integer cellSizeM) {
        public static StudyAreaDto from(StudyArea s) {
            var env = s.getBoundary().getEnvelopeInternal();
            return new StudyAreaDto(s.getId(), s.getCode(), s.getName(), s.getCity(), s.getState(), s.getCountry(), s.getDescription(),
                    new double[]{env.getMinX(), env.getMinY(), env.getMaxX(), env.getMaxY()},
                    new double[]{s.getCenter().getX(), s.getCenter().getY()}, s.getProcessingEpsg(), s.getResolutionM(), s.getCellSizeM());
        }
    }

    public record DatasetDto(Long id, String aiDatasetId, String name, String dataType, String source, String collectionDate,
                             String coverage, String fileFormat, String fileName, Long fileSize, boolean demo, boolean realData,
                             JsonNode metadata, String uploadedBy, OffsetDateTime createdAt) {
        public static DatasetDto from(Dataset d) {
            return new DatasetDto(d.getId(), d.getAiDatasetId(), d.getName(), d.getDataType(), d.getSource(), d.getCollectionDate(),
                    d.getCoverage(), d.getFileFormat(), d.getFileName(), d.getFileSize(), d.isDemo(), d.isRealData(), d.getMetadata(),
                    d.getUploadedBy() == null ? null : d.getUploadedBy().getUsername(), d.getCreatedAt());
        }
    }

    public record IndicatorRow(Long regionId, String regionCode, String name, String locality, double lon, double lat,
                               Double lstMean, Double lstMin, Double lstMax, Double ndvi, Double ndbi, Double ndwi, Double albedo,
                               Integer lulc, String lulcName, Double builtFraction, Double vegetationFraction, Double waterFraction,
                               Double openLandFraction, Double airTempMax, Double relativeHumidity, Double windSpeed,
                               Double population, Double populationDensity, Double roadDensity, Double validPixelPct, boolean labelQualityOk) {
        public static IndicatorRow from(EnvironmentalIndicator i) {
            GeographicRegion r = i.getRegion();
            return new IndicatorRow(r.getId(), r.getRegionCode(), r.getName(), r.getLocality(), r.getCentroid().getX(), r.getCentroid().getY(),
                    i.getLstMean(), i.getLstMin(), i.getLstMax(), i.getNdviMean(), i.getNdbiMean(), i.getNdwiMean(), i.getAlbedoMean(),
                    i.getLulcMajority(), i.getLulcMajorityName(), i.getBuiltFraction(), i.getVegetationFraction(), i.getWaterFraction(),
                    i.getOpenLandFraction(), i.getAirTempMax(), i.getRelativeHumidity(), i.getWindSpeed(), i.getPopulation(),
                    i.getPopulationDensity(), i.getRoadDensity(), i.getValidPixelPct(), i.isLabelQualityOk());
        }
    }

    public record PriorityDto(Long id, Integer rank, Double score, String level, Map<String, Double> components,
                              Map<String, Double> contributions, JsonNode weights, Double expectedCoolingC, Double estimatedCost,
                              Integer nInterventions) {
        public static PriorityDto from(PriorityRanking p) {
            Map<String, Double> comp = new java.util.LinkedHashMap<>();
            comp.put("heat_severity", p.getHeatScore());
            comp.put("population_vulnerability", p.getVulnerabilityScore());
            comp.put("vegetation_deficit", p.getVegetationDeficitScore());
            comp.put("implementation_feasibility", p.getFeasibilityScore());
            comp.put("cooling_benefit", p.getCoolingBenefitScore());
            Map<String, Double> contrib = new java.util.LinkedHashMap<>();
            comp.forEach((k, v) -> contrib.put(k, Math.round(100 * v * p.getWeights().path(k).asDouble(0) * 100.0) / 100.0));
            return new PriorityDto(p.getId(), p.getRank(), p.getScore(), p.getPriorityLevel(), comp, contrib, p.getWeights(),
                    p.getExpectedCoolingC(), p.getEstimatedCost(), p.getNInterventions());
        }
    }

    public record HotspotRow(Long hotspotId, Long regionId, String regionCode, String name, String locality, double lon, double lat,
                             String severity, String severitySource, String observedSeverity, String predictedSeverity, boolean hotspot,
                             Double lst, Double lstAnomaly, Double giStarZ, boolean giStarSignificant, Double ndvi, Double ndbi,
                             Double builtFraction, Double populationDensity, PriorityDto priority) {
        public static HotspotRow from(Hotspot h, EnvironmentalIndicator i, PriorityRanking p) {
            GeographicRegion r = h.getRegion();
            return new HotspotRow(h.getId(), r.getId(), r.getRegionCode(), r.getName(), r.getLocality(), h.getLocation().getX(), h.getLocation().getY(),
                    h.getSeverity(), h.getSeveritySource(), h.getObservedSeverity(), h.getPredictedSeverity(), h.isHotspot(), h.getLst(),
                    h.getLstAnomaly(), h.getGiStarZ(), h.isGiStarSignificant(), i == null ? null : i.getNdviMean(),
                    i == null ? null : i.getNdbiMean(), i == null ? null : i.getBuiltFraction(), i == null ? null : i.getPopulationDensity(),
                    p == null ? null : PriorityDto.from(p));
        }
    }

    public record CostDto(Double estimated, Double low, Double high, Double unitCost, String unitCostBasis, Double costPerDegree,
                          String currency, boolean approximate) {
        public static CostDto from(CostEstimate c) {
            return c == null ? null : new CostDto(c.getEstimatedCost(), c.getCostLow(), c.getCostHigh(), c.getUnitCost(), c.getUnitCostBasis(),
                    c.getCostPerDegree(), c.getCurrency(), c.isApproximate());
        }
    }

    public record RecommendationRow(Long id, String type, String name, String description, Long regionId, String regionCode,
                                    String regionName, String locality, double lon, double lat, String locationDescription,
                                    String reason, Double areaM2, Double quantity, String unit, Double coolingC, Double suitability,
                                    String priorityLevel, Integer costEffectivenessRank, CostDto cost) {
        public static RecommendationRow from(MitigationRecommendation m, CostEstimate c) {
            GeographicRegion r = m.getRegion();
            return new RecommendationRow(m.getId(), m.getInterventionType(), m.getInterventionName(), m.getDescription(), r.getId(),
                    r.getRegionCode(), r.getName(), r.getLocality(), m.getLocation().getX(), m.getLocation().getY(), m.getLocationDescription(),
                    m.getReason(), m.getAreaM2(), m.getQuantity(), m.getUnit(), m.getCoolingC(), m.getSuitability(), m.getPriorityLevel(),
                    m.getCostEffectivenessRank(), CostDto.from(c));
        }
    }

    public record PredictionModelView(String predictedClass, Double predictedLst, JsonNode probabilities, boolean bestModel) {
    }

    public record PredictionRow(Long regionId, String regionCode, String name, String locality, Double observedLst, String observedClass,
                                Map<String, PredictionModelView> models) {
    }

    public record EvaluationDto(String modelName, String task, Double accuracy, Double precision, Double recall, Double f1, Double mae,
                                Double rmse, Double r2, Double cvMean, Double cvStd, Integer trainSamples, Integer testSamples,
                                Double trainingSeconds, boolean best, JsonNode confusionMatrix, JsonNode featureImportance, JsonNode details) {
        public static EvaluationDto from(ModelEvaluation e) {
            return new EvaluationDto(e.getModelName(), e.getTask(), e.getAccuracy(), e.getPrecisionMacro(), e.getRecallMacro(), e.getF1Macro(),
                    e.getMae(), e.getRmse(), e.getR2(), e.getCvMean(), e.getCvStd(), e.getTrainSamples(), e.getTestSamples(),
                    e.getTrainingSeconds(), e.isBest(), e.getConfusionMatrix(), e.getFeatureImportance(), e.getDetails());
        }
    }

    public record LocalExplanationDto(Long regionId, String regionCode, String name, String model, Double baseValue, Double predictedValue,
                                      String predictedClass, Double observedLst, JsonNode contributions, JsonNode classContributions,
                                      String explanation) {
    }

    public record WeightsRequest(@NotNull @DecimalMin("0") @DecimalMax("1") Double heatSeverity,
                                 @NotNull @DecimalMin("0") @DecimalMax("1") Double populationVulnerability,
                                 @NotNull @DecimalMin("0") @DecimalMax("1") Double vegetationDeficit,
                                 @NotNull @DecimalMin("0") @DecimalMax("1") Double implementationFeasibility,
                                 @NotNull @DecimalMin("0") @DecimalMax("1") Double coolingBenefit) {
        public Map<String, Double> toMap() {
            double sum = heatSeverity + populationVulnerability + vegetationDeficit + implementationFeasibility + coolingBenefit;
            if (sum <= 0) {
                throw new IllegalArgumentException("At least one weight must be greater than zero");
            }
            Map<String, Double> m = new java.util.LinkedHashMap<>();
            m.put("heat_severity", heatSeverity / sum);
            m.put("population_vulnerability", populationVulnerability / sum);
            m.put("vegetation_deficit", vegetationDeficit / sum);
            m.put("implementation_feasibility", implementationFeasibility / sum);
            m.put("cooling_benefit", coolingBenefit / sum);
            return m;
        }
    }

    public record BudgetPlanRequest(Long runId, @NotNull @Positive Double budgetInr, List<String> strategies, Boolean onePerRegion) {
    }

    public record ReportRequest(Long runId, @NotBlank @Size(max = 200) String title) {
    }
}
