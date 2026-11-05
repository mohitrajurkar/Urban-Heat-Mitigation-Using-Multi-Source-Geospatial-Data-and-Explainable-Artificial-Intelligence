package com.urbanheat.repository;

import com.urbanheat.entity.MitigationRecommendation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface MitigationRecommendationRepository extends JpaRepository<MitigationRecommendation, Long> {
    @Query("select m from MitigationRecommendation m join fetch m.region r where m.run.id = :runId order by m.costEffectivenessRank")
    List<MitigationRecommendation> findByRunWithRegion(Long runId);

    @Query("select m from MitigationRecommendation m where m.region.id = :regionId order by m.coolingC desc")
    List<MitigationRecommendation> findByRegionId(Long regionId);

    @Modifying
    @Query("update MitigationRecommendation m set m.priorityLevel = :level where m.region.id in :regionIds")
    int updatePriorityLevel(java.util.Collection<Long> regionIds, String level);
}
