package com.urbanheat.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.locationtech.jts.geom.Polygon;

import java.time.OffsetDateTime;

@Entity
@Table(name = "datasets")
@Getter
@Setter
@NoArgsConstructor
public class Dataset {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ai_dataset_id", nullable = false, unique = true, length = 64)
    private String aiDatasetId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "study_area_id")
    private StudyArea studyArea;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "data_type", nullable = false, length = 30)
    private String dataType;

    private String source;

    @Column(name = "collection_date", length = 40)
    private String collectionDate;

    private String coverage;

    @Column(name = "file_format", length = 20)
    private String fileFormat;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_size")
    private Long fileSize;

    @Column(name = "is_demo", nullable = false)
    private boolean demo;

    @Column(name = "is_real", nullable = false)
    private boolean realData = true;

    @Column(columnDefinition = "geometry(Polygon,4326)")
    private Polygon footprint;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private JsonNode metadata;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by")
    private User uploadedBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
