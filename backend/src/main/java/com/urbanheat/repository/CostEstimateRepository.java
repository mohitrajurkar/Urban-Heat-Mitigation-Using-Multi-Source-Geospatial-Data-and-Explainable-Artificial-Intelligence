package com.urbanheat.repository;

import com.urbanheat.entity.CostEstimate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CostEstimateRepository extends JpaRepository<CostEstimate, Long> {
    @Query("select c from CostEstimate c join fetch c.recommendation m where c.run.id = :runId")
    List<CostEstimate> findByRunWithRecommendation(Long runId);
}
