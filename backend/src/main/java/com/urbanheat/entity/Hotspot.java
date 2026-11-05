package com.urbanheat.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.locationtech.jts.geom.Point;

import java.time.OffsetDateTime;

/** Heat-severity classification of every region; is_hotspot marks High / Very High regions. */
@Entity
@Table(name = "hotspots")
@Getter
@Setter
@NoArgsConstructor
public class Hotspot {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "hotspot_seq")
    @SequenceGenerator(name = "hotspot_seq", sequenceName = "hotspots_id_seq", allocationSize = 50)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id")
    private AnalysisRun run;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "region_id")
    private GeographicRegion region;

    @Column(nullable = false, length = 20) private String severity;
    @Column(name = "severity_source", length = 60) private String severitySource;
    @Column(name = "observed_severity", length = 20) private String observedSeverity;
    @Column(name = "predicted_severity", length = 20) private String predictedSeverity;
    @Column(name = "is_hotspot", nullable = false) private boolean hotspot;
    private Double lst;
    @Column(name = "lst_anomaly") private Double lstAnomaly;
    @Column(name = "gi_star_z") private Double giStarZ;
    @Column(name = "gi_star_significant", nullable = false) private boolean giStarSignificant;

    @Column(columnDefinition = "geometry(Point,4326)", nullable = false)
    private Point location;

    @Column(name = "detected_at", nullable = false) private OffsetDateTime detectedAt = OffsetDateTime.now();
}
