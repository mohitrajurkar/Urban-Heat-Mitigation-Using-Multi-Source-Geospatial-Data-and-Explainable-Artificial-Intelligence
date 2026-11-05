package com.urbanheat.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.locationtech.jts.geom.Point;

import java.time.OffsetDateTime;

@Entity
@Table(name = "mitigation_recommendations")
@Getter
@Setter
@NoArgsConstructor
public class MitigationRecommendation {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "rec_seq")
    @SequenceGenerator(name = "rec_seq", sequenceName = "mitigation_recommendations_id_seq", allocationSize = 50)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id")
    private AnalysisRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "hotspot_id")
    private Hotspot hotspot;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "region_id")
    private GeographicRegion region;

    @Column(name = "intervention_type", nullable = false, length = 30) private String interventionType;
    @Column(name = "intervention_name", nullable = false, length = 80) private String interventionName;
    @Column(columnDefinition = "text") private String description;
    @Column(columnDefinition = "text", nullable = false) private String reason;

    @Column(columnDefinition = "geometry(Point,4326)", nullable = false)
    private Point location;

    @Column(name = "location_description", length = 300) private String locationDescription;
    @Column(name = "area_m2", nullable = false) private Double areaM2;
    private Double quantity;
    @Column(length = 20) private String unit;
    @Column(name = "cooling_c", nullable = false) private Double coolingC;
    private Double suitability;
    @Column(name = "priority_level", nullable = false, length = 20) private String priorityLevel;
    @Column(name = "cost_effectiveness_rank") private Integer costEffectivenessRank;

    @Column(name = "created_at", nullable = false) private OffsetDateTime createdAt = OffsetDateTime.now();
}
