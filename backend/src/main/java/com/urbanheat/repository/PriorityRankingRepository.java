package com.urbanheat.repository;

import com.urbanheat.entity.PriorityRanking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PriorityRankingRepository extends JpaRepository<PriorityRanking, Long> {
    @Query("select p from PriorityRanking p join fetch p.region r join fetch p.hotspot h where p.run.id = :runId order by p.rank")
    List<PriorityRanking> findByRunWithRegion(Long runId);

    Optional<PriorityRanking> findByRegionId(Long regionId);
}
