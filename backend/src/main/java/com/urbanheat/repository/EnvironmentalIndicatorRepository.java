package com.urbanheat.repository;

import com.urbanheat.entity.EnvironmentalIndicator;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface EnvironmentalIndicatorRepository extends JpaRepository<EnvironmentalIndicator, Long> {
    @Query("select i from EnvironmentalIndicator i join fetch i.region r where i.run.id = :runId order by r.cellIndex")
    List<EnvironmentalIndicator> findByRunWithRegion(Long runId);

    @Query("select i from EnvironmentalIndicator i join fetch i.region r where r.id = :regionId")
    Optional<EnvironmentalIndicator> findByRegionId(Long regionId);
}
