package com.urbanheat.repository;

import com.urbanheat.entity.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {
    /** Listing projection without the PDF bytes. */
    @Query("select r.id as id, r.title as title, r.fileName as fileName, r.fileSize as fileSize, r.createdAt as createdAt, "
            + "r.run.id as runId, g.username as generatedBy from Report r left join r.generatedBy g order by r.createdAt desc")
    List<ReportSummary> findSummaries();

    interface ReportSummary {
        Long getId();
        String getTitle();
        String getFileName();
        Long getFileSize();
        java.time.OffsetDateTime getCreatedAt();
        Long getRunId();
        String getGeneratedBy();
    }
}
