package com.urbanheat.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "environmental_indicators")
@Getter
@Setter
@NoArgsConstructor
public class EnvironmentalIndicator {
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "indicator_seq")
    @SequenceGenerator(name = "indicator_seq", sequenceName = "environmental_indicators_id_seq", allocationSize = 50)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "region_id")
    private GeographicRegion region;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "run_id")
    private AnalysisRun run;

    @Column(name = "lst_mean") private Double lstMean;
    @Column(name = "lst_min") private Double lstMin;
    @Column(name = "lst_max") private Double lstMax;
    @Column(name = "lst_std") private Double lstStd;
    @Column(name = "ndvi_mean") private Double ndviMean;
    @Column(name = "ndbi_mean") private Double ndbiMean;
    @Column(name = "ndwi_mean") private Double ndwiMean;
    @Column(name = "albedo_mean") private Double albedoMean;
    @Column(name = "lulc_majority") private Integer lulcMajority;
    @Column(name = "lulc_majority_name", length = 60) private String lulcMajorityName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lulc_fractions", columnDefinition = "jsonb")
    private JsonNode lulcFractions;

    @Column(name = "built_fraction") private Double builtFraction;
    @Column(name = "vegetation_fraction") private Double vegetationFraction;
    @Column(name = "water_fraction") private Double waterFraction;
    @Column(name = "open_land_fraction") private Double openLandFraction;
    @Column(name = "air_temp_max") private Double airTempMax;
    @Column(name = "relative_humidity") private Double relativeHumidity;
    @Column(name = "wind_speed") private Double windSpeed;
    @Column(name = "population") private Double population;
    @Column(name = "population_density") private Double populationDensity;
    @Column(name = "road_density") private Double roadDensity;
    @Column(name = "valid_pixel_pct") private Double validPixelPct;
    @Column(name = "label_quality_ok", nullable = false) private boolean labelQualityOk = true;
}
