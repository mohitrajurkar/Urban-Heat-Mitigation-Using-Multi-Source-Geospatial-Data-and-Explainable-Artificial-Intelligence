package com.urbanheat.controller;

import com.urbanheat.service.AiServiceClient;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@Tag(name = "System")
public class SystemController {
    private final JdbcTemplate jdbc;
    private final AiServiceClient ai;

    @GetMapping("/api/system/health")
    @Operation(summary = "Connectivity of backend, PostgreSQL/PostGIS and the AI service (public)")
    public Map<String, Object> health() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("timestamp", OffsetDateTime.now());
        out.put("backend", Map.of("status", "UP", "version", "1.0.0"));
        try {
            String pg = jdbc.queryForObject("select version()", String.class);
            String postgis = jdbc.queryForObject("select postgis_lib_version()", String.class);
            out.put("database", Map.of("status", "UP", "postgres", pg == null ? "" : pg.split(",")[0], "postgis", postgis == null ? "" : postgis));
        } catch (Exception e) {
            out.put("database", Map.of("status", "DOWN", "error", String.valueOf(e.getMessage())));
        }
        try {
            out.put("aiService", ai.health());
        } catch (Exception e) {
            out.put("aiService", Map.of("status", "DOWN", "error", String.valueOf(e.getMessage())));
        }
        return out;
    }
}
