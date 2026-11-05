package com.urbanheat.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "priority_rankings")
@Getter
@Setter
@NoArgsConstructor
public class PriorityRanking {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "rank_seq")
    @SequenceGenerator(name = "rank_seq", sequenceName = "priority_rankings_id_seq", allocationSize = 50)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id")
    private AnalysisRun run;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotspot_id")
    private Hotspot hotspot;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "region_id")
    private GeographicRegion region;

    @Column(name = "rank", nullable = false) private Integer rank;
    @Column(nullable = false) private Double score;
    @Column(name = "priority_level", nullable = false, length = 20) private String priorityLevel;
    @Column(name = "heat_score", nullable = false) private Double heatScore;
    @Column(name = "vulnerability_score", nullable = false) private Double vulnerabilityScore;
    @Column(name = "vegetation_deficit_score", nullable = false) private Double vegetationDeficitScore;
    @Column(name = "feasibility_score", nullable = false) private Double feasibilityScore;
    @Column(name = "cooling_benefit_score", nullable = false) private Double coolingBenefitScore;
    @Column(name = "expected_cooling_c") private Double expectedCoolingC;
    @Column(name = "estimated_cost") private Double estimatedCost;
    @Column(name = "n_interventions") private Integer nInterventions;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    private JsonNode weights;
}
