package com.mohit.urbanheatai.dto;

import java.util.List;
import java.util.Map;

public class DecisionResultDTO {
    private String wardId;
    private String wardName;

    public static class HeatSeverityDetails {
        private Double score;
        private String level;
        private Map<String, Double> breakdown;
        private String modelNote;

        public HeatSeverityDetails() {}
        public HeatSeverityDetails(Double score, String level, Map<String, Double> breakdown, String modelNote) {
            this.score = score;
            this.level = level;
            this.breakdown = breakdown;
            this.modelNote = modelNote;
        }
        public Double getScore() { return score; }
        public void setScore(Double score) { this.score = score; }
        public String getLevel() { return level; }
        public void setLevel(String level) { this.level = level; }
        public Map<String, Double> getBreakdown() { return breakdown; }
        public void setBreakdown(Map<String, Double> breakdown) { this.breakdown = breakdown; }
        public String getModelNote() { return modelNote; }
        public void setModelNote(String modelNote) { this.modelNote = modelNote; }
    }

    public static class VulnerabilityDetails {
        private Double score;
        private String level;
        private List<String> factors;

        public VulnerabilityDetails() {}
        public VulnerabilityDetails(Double score, String level, List<String> factors) {
            this.score = score;
            this.level = level;
            this.factors = factors;
        }
        public Double getScore() { return score; }
        public void setScore(Double score) { this.score = score; }
        public String getLevel() { return level; }
        public void setLevel(String level) { this.level = level; }
        public List<String> getFactors() { return factors; }
        public void setFactors(List<String> factors) { this.factors = factors; }
    }

    public static class PriorityDetails {
        private Double score;
        private String level;
        private String reason;

        public PriorityDetails() {}
        public PriorityDetails(Double score, String level, String reason) {
            this.score = score;
            this.level = level;
            this.reason = reason;
        }
        public Double getScore() { return score; }
        public void setScore(Double score) { this.score = score; }
        public String getLevel() { return level; }
        public void setLevel(String level) { this.level = level; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }

    public static class ExplainableFactorsDetails {
        private String title;
        private List<String> whyHighPriority;
        private String whyStrategyRecommended;
        private String shapPlaceholderNote;

        public ExplainableFactorsDetails() {}
        public ExplainableFactorsDetails(String title, List<String> whyHighPriority,
                                         String whyStrategyRecommended, String shapPlaceholderNote) {
            this.title = title;
            this.whyHighPriority = whyHighPriority;
            this.whyStrategyRecommended = whyStrategyRecommended;
            this.shapPlaceholderNote = shapPlaceholderNote;
        }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public List<String> getWhyHighPriority() { return whyHighPriority; }
        public void setWhyHighPriority(List<String> whyHighPriority) { this.whyHighPriority = whyHighPriority; }
        public String getWhyStrategyRecommended() { return whyStrategyRecommended; }
        public void setWhyStrategyRecommended(String whyStrategyRecommended) { this.whyStrategyRecommended = whyStrategyRecommended; }
        public String getShapPlaceholderNote() { return shapPlaceholderNote; }
        public void setShapPlaceholderNote(String shapPlaceholderNote) { this.shapPlaceholderNote = shapPlaceholderNote; }
    }

    private HeatSeverityDetails heatSeverity;
    private VulnerabilityDetails vulnerability;
    private PriorityDetails priority;
    private ExplainableFactorsDetails explainableFactors;
    private List<RecommendationDTO> recommendations;

    public DecisionResultDTO() {}

    public String getWardId() { return wardId; }
    public void setWardId(String wardId) { this.wardId = wardId; }

    public String getWardName() { return wardName; }
    public void setWardName(String wardName) { this.wardName = wardName; }

    public HeatSeverityDetails getHeatSeverity() { return heatSeverity; }
    public void setHeatSeverity(HeatSeverityDetails heatSeverity) { this.heatSeverity = heatSeverity; }

    public VulnerabilityDetails getVulnerability() { return vulnerability; }
    public void setVulnerability(VulnerabilityDetails vulnerability) { this.vulnerability = vulnerability; }

    public PriorityDetails getPriority() { return priority; }
    public void setPriority(PriorityDetails priority) { this.priority = priority; }

    public ExplainableFactorsDetails getExplainableFactors() { return explainableFactors; }
    public void setExplainableFactors(ExplainableFactorsDetails explainableFactors) { this.explainableFactors = explainableFactors; }

    public List<RecommendationDTO> getRecommendations() { return recommendations; }
    public void setRecommendations(List<RecommendationDTO> recommendations) { this.recommendations = recommendations; }
}
