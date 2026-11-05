package com.urbanheat.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "analysis_runs")
@Getter
@Setter
@NoArgsConstructor
public class AnalysisRun {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ai_run_id", unique = true, length = 64)
    private String aiRunId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "study_area_id")
    private StudyArea studyArea;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private RunStatus status = RunStatus.PENDING;

    @Column(name = "current_step", length = 200)
    private String currentStep;

    @Column(nullable = false)
    private int progress;

    @Column(columnDefinition = "text")
    private String message;

    @Column(name = "is_demo", nullable = false)
    private boolean demo;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private JsonNode parameters;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "dataset_selection", columnDefinition = "jsonb")
    private JsonNode datasetSelection;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "preprocessing_summary", columnDefinition = "jsonb")
    private JsonNode preprocessingSummary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "feature_summary", columnDefinition = "jsonb")
    private JsonNode featureSummary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "evaluation_summary", columnDefinition = "jsonb")
    private JsonNode evaluationSummary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "shap_global", columnDefinition = "jsonb")
    private JsonNode shapGlobal;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "layers_meta", columnDefinition = "jsonb")
    private JsonNode layersMeta;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "hotspot_summary", columnDefinition = "jsonb")
    private JsonNode hotspotSummary;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "recommendation_summary", columnDefinition = "jsonb")
    private JsonNode recommendationSummary;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(name = "started_at", nullable = false)
    private OffsetDateTime startedAt = OffsetDateTime.now();

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;
}
