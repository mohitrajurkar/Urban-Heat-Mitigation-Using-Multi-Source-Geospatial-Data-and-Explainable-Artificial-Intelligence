package com.urbanheat.repository;

import com.urbanheat.entity.AiPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface AiPredictionRepository extends JpaRepository<AiPrediction, Long> {
    @Query("select p from AiPrediction p join fetch p.region r where p.run.id = :runId order by r.cellIndex, p.modelName")
    List<AiPrediction> findByRunWithRegion(Long runId);

    @Query("select p from AiPrediction p where p.region.id = :regionId order by p.modelName")
    List<AiPrediction> findByRegionId(Long regionId);
}
