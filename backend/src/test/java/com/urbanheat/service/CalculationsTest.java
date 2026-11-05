package com.urbanheat.service;

import com.urbanheat.dto.PageResponse;
import com.urbanheat.dto.ViewDtos.WeightsRequest;
import com.urbanheat.util.GeoUtil;
import com.urbanheat.util.Maps;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

class CalculationsTest {

    @Test
    void pearsonCorrelation() {
        double[] x = {1, 2, 3, 4, 5};
        assertThat(InsightService.pearson(x, new double[]{2, 4, 6, 8, 10})).isCloseTo(1.0, within(1e-12));
        assertThat(InsightService.pearson(x, new double[]{5, 4, 3, 2, 1})).isCloseTo(-1.0, within(1e-12));
        assertThat(InsightService.pearson(new double[]{1, Double.NaN}, new double[]{1, 2})).isNull();
    }

    @Test
    void histogramCountsEveryValue() {
        double[] v = IntStream.range(0, 100).mapToDouble(i -> i).toArray();
        List<Map<String, Object>> h = InsightService.histogram(v, 10);
        assertThat(h).hasSize(10);
        assertThat(h.stream().mapToInt(b -> (Integer) b.get("count")).sum()).isEqualTo(100);
    }

    @Test
    void priorityLevelThresholds() {
        var levels = List.of(Maps.of("level", "Critical", "min", 70.0), Maps.of("level", "High", "min", 55.0),
                Maps.of("level", "Medium", "min", 40.0), Maps.of("level", "Low", "min", 0.0));
        assertThat(PlanningService.levelFor(85, levels)).isEqualTo("Critical");
        assertThat(PlanningService.levelFor(55, levels)).isEqualTo("High");
        assertThat(PlanningService.levelFor(41, levels)).isEqualTo("Medium");
        assertThat(PlanningService.levelFor(3, levels)).isEqualTo("Low");
    }

    @Test
    void weightsAreNormalisedToOne() {
        Map<String, Double> w = new WeightsRequest(2.0, 1.0, 1.0, 0.0, 0.0).toMap();
        assertThat(w.values().stream().mapToDouble(Double::doubleValue).sum()).isCloseTo(1.0, within(1e-12));
        assertThat(w.get("heat_severity")).isCloseTo(0.5, within(1e-12));
        assertThatThrownBy(() -> new WeightsRequest(0.0, 0.0, 0.0, 0.0, 0.0).toMap()).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void pagination() {
        List<Integer> all = IntStream.range(0, 53).boxed().toList();
        PageResponse<Integer> p = PageResponse.of(all, 2, 25);
        assertThat(p.content()).containsExactly(50, 51, 52);
        assertThat(p.totalPages()).isEqualTo(3);
        assertThat(PageResponse.of(all, 9, 25).content()).isEmpty();
    }

    @Test
    void geoJsonRoundTrip() throws Exception {
        var mapper = new ObjectMapper();
        var geom = mapper.readTree("{\"type\":\"Polygon\",\"coordinates\":[[[79.0,21.1],[79.1,21.1],[79.1,21.2],[79.0,21.2],[79.0,21.1]]]}");
        var poly = GeoUtil.polygon(geom);
        assertThat(poly.getSRID()).isEqualTo(4326);
        assertThat(poly.getCentroid().getX()).isCloseTo(79.05, within(1e-9));
        assertThat(GeoUtil.toGeoJson(poly, mapper)).isEqualTo(geom);
        assertThat(Maps.of("a", Double.NaN).get("a")).isNull();
    }
}
