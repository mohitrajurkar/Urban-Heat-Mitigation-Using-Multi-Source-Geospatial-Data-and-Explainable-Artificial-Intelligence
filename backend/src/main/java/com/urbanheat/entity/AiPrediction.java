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
@Table(name = "ai_predictions")
@Getter
@Setter
@NoArgsConstructor
public class AiPrediction {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "prediction_seq")
    @SequenceGenerator(name = "prediction_seq", sequenceName = "ai_predictions_id_seq", allocationSize = 50)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id")
    private AnalysisRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "region_id")
    private GeographicRegion region;

    @Column(name = "model_name", nullable = false, length = 40) private String modelName;
    @Column(name = "predicted_class", nullable = false, length = 20) private String predictedClass;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "class_probabilities", columnDefinition = "jsonb")
    private JsonNode classProbabilities;

    @Column(name = "predicted_lst") private Double predictedLst;
    @Column(name = "observed_class", length = 20) private String observedClass;
    @Column(name = "observed_lst") private Double observedLst;
    @Column(name = "is_best_model", nullable = false) private boolean bestModel;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
}
