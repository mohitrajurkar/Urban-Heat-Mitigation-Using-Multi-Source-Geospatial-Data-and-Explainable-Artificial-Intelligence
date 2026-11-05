package com.urbanheat.repository;

import com.urbanheat.entity.ModelEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ModelEvaluationRepository extends JpaRepository<ModelEvaluation, Long> {
    List<ModelEvaluation> findByRunIdOrderByModelNameAscTaskAsc(Long runId);
}
