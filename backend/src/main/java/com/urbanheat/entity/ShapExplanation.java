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
@Table(name = "shap_explanations")
@Getter
@Setter
@NoArgsConstructor
public class ShapExplanation {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "shap_seq")
    @SequenceGenerator(name = "shap_seq", sequenceName = "shap_explanations_id_seq", allocationSize = 50)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id")
    private AnalysisRun run;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "region_id")
    private GeographicRegion region;

    @Column(name = "model_name", nullable = false, length = 40) private String modelName;
    @Column(name = "explanation_type", nullable = false, length = 10) private String explanationType;
    @Column(length = 20) private String task;
    @Column(name = "base_value") private Double baseValue;
    @Column(name = "predicted_value") private Double predictedValue;
    @Column(name = "predicted_class", length = 20) private String predictedClass;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private JsonNode contributions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "class_contributions", columnDefinition = "jsonb")
    private JsonNode classContributions;

    @Column(name = "explanation_text", columnDefinition = "text") private String explanationText;
    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
}
