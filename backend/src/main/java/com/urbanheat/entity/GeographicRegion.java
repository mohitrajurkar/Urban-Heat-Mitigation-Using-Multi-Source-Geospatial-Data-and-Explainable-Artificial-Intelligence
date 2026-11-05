package com.urbanheat.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.Polygon;

/** A square analysis cell (default 500 m x 500 m) of an analysis run. */
@Entity
@Table(name = "geographic_regions")
@Getter
@Setter
@NoArgsConstructor
public class GeographicRegion {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "region_seq")
    @SequenceGenerator(name = "region_seq", sequenceName = "geographic_regions_id_seq", allocationSize = 50)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id")
    private AnalysisRun run;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "study_area_id")
    private StudyArea studyArea;

    @Column(name = "cell_index", nullable = false)
    private Integer cellIndex;

    @Column(name = "region_code", nullable = false, length = 30)
    private String regionCode;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(length = 80)
    private String locality;

    @Column(name = "row_idx", nullable = false)
    private Integer rowIdx;

    @Column(name = "col_idx", nullable = false)
    private Integer colIdx;

    @Column(name = "area_km2", nullable = false)
    private Double areaKm2;

    @Column(columnDefinition = "geometry(Polygon,4326)", nullable = false)
    private Polygon geom;

    @Column(columnDefinition = "geometry(Point,4326)", nullable = false)
    private Point centroid;
}
