package com.urbanheat.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.Polygon;

import java.time.OffsetDateTime;

@Entity
@Table(name = "study_areas")
@Getter
@Setter
@NoArgsConstructor
public class StudyArea {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 40)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, length = 80)
    private String city;

    private String state;
    private String country;

    @Column(columnDefinition = "text")
    private String description;

    @Column(columnDefinition = "geometry(Polygon,4326)", nullable = false)
    private Polygon boundary;

    @Column(columnDefinition = "geometry(Point,4326)", nullable = false)
    private Point center;

    @Column(name = "processing_epsg", nullable = false)
    private Integer processingEpsg;

    @Column(name = "resolution_m", nullable = false)
    private Integer resolutionM;

    @Column(name = "cell_size_m", nullable = false)
    private Integer cellSizeM;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
