package com.urbanheat.repository;

import com.urbanheat.entity.Hotspot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface HotspotRepository extends JpaRepository<Hotspot, Long> {
    @Query("select h from Hotspot h join fetch h.region r where h.run.id = :runId order by r.cellIndex")
    List<Hotspot> findByRunWithRegion(Long runId);

    @Query("select h from Hotspot h join fetch h.region r where h.id = :id")
    Optional<Hotspot> findByIdWithRegion(Long id);

    Optional<Hotspot> findByRegionId(Long regionId);
}
