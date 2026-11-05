package com.urbanheat.repository;

import com.urbanheat.entity.ShapExplanation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShapExplanationRepository extends JpaRepository<ShapExplanation, Long> {
    Optional<ShapExplanation> findFirstByRegionIdAndExplanationType(Long regionId, String explanationType);

    List<ShapExplanation> findByRunIdAndExplanationType(Long runId, String explanationType);
}
