package com.urbanheat.repository;

import com.urbanheat.entity.GeographicRegion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GeographicRegionRepository extends JpaRepository<GeographicRegion, Long> {
    List<GeographicRegion> findByRunIdOrderByCellIndex(Long runId);

    long countByRunId(Long runId);
}
