package com.urbanheat.repository;

import com.urbanheat.entity.Dataset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DatasetRepository extends JpaRepository<Dataset, Long> {
    Optional<Dataset> findByAiDatasetId(String aiDatasetId);

    List<Dataset> findAllByOrderByDemoDescCreatedAtDesc();
}
