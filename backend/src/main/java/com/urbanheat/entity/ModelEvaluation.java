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
@Table(name = "model_evaluations")
@Getter
@Setter
@NoArgsConstructor
public class ModelEvaluation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id")
    private AnalysisRun run;

    @Column(name = "model_name", nullable = false, length = 40) private String modelName;
    @Column(nullable = false, length = 20) private String task;
    private Double accuracy;
    @Column(name = "precision_macro") private Double precisionMacro;
    @Column(name = "recall_macro") private Double recallMacro;
    @Column(name = "f1_macro") private Double f1Macro;
    private Double mae;
    private Double rmse;
    private Double r2;
    @Column(name = "cv_mean") private Double cvMean;
    @Column(name = "cv_std") private Double cvStd;
    @Column(name = "train_samples") private Integer trainSamples;
    @Column(name = "test_samples") private Integer testSamples;
    @Column(name = "training_seconds") private Double trainingSeconds;
    @Column(name = "is_best", nullable = false) private boolean best;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "confusion_matrix", columnDefinition = "jsonb")
    private JsonNode confusionMatrix;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "feature_importance", columnDefinition = "jsonb")
    private JsonNode featureImportance;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private JsonNode details;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
