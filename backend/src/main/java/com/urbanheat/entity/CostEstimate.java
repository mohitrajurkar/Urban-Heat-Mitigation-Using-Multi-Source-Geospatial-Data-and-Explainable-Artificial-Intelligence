package com.urbanheat.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Approximate implementation cost of one recommendation (see strategies.json assumptions). */
@Entity
@Table(name = "cost_estimates")
@Getter
@Setter
@NoArgsConstructor
public class CostEstimate {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "cost_seq")
    @SequenceGenerator(name = "cost_seq", sequenceName = "cost_estimates_id_seq", allocationSize = 50)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recommendation_id")
    private MitigationRecommendation recommendation;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id")
    private AnalysisRun run;

    @Column(nullable = false, length = 5) private String currency = "INR";
    @Column(name = "unit_cost", nullable = false) private Double unitCost;
    @Column(name = "unit_cost_basis", length = 300) private String unitCostBasis;
    @Column(name = "estimated_cost", nullable = false) private Double estimatedCost;
    @Column(name = "cost_low") private Double costLow;
    @Column(name = "cost_high") private Double costHigh;
    @Column(name = "cost_per_degree") private Double costPerDegree;
    @Column(name = "is_approximate", nullable = false) private boolean approximate = true;
}
