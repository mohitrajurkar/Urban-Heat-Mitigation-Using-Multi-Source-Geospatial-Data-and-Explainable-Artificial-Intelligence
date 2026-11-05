package com.urbanheat.repository;

import com.urbanheat.entity.AnalysisRun;
import com.urbanheat.entity.RunStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface AnalysisRunRepository extends JpaRepository<AnalysisRun, Long> {
    Optional<AnalysisRun> findFirstByStatusOrderByCompletedAtDesc(RunStatus status);

    List<AnalysisRun> findAllByOrderByStartedAtDesc();

    boolean existsByStatusIn(List<RunStatus> statuses);

    long countByStatus(RunStatus status);

    @Modifying
    @Query("update AnalysisRun r set r.status = com.urbanheat.entity.RunStatus.FAILED, r.message = :msg "
            + "where r.status in (com.urbanheat.entity.RunStatus.PENDING, com.urbanheat.entity.RunStatus.RUNNING)")
    int failInterruptedRuns(String msg);
}
